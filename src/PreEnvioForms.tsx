import React, { useEffect, useMemo, useState } from "react";

/** ============== LISTAS (do seu código antigo) ============== */
const CLASSIFICACOES = ["Selecione…","Quase acidente","Comportamento inseguro","Condição insegura"];
const EMPRESAS = ["Selecione…","Raízen","Contratada"];
const UNIDADES = [
  "Selecione…",
  "Araraquara","Barra","Benalcool","Bonfim","Caarapó","Continental","Costa Pinto",
  "Destivale","Diamante","Dois Córregos","Gasa","Ipaussu","Jataí","Junqueira",
  "Lagoa da Prata","Leme","Maracaí","MB","Mundial","Paraguaçú","Paraíso",
  "Passa Tempo","Rafard","Rio Brilhante","Santa Cândida","Santa Elisa",
  "Santa Helena","São Francisco","Serra","Tarumã","Univalem","Vale do Rosário"
];
const HORAS = [
  "Selecione…",
  "00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30",
  "05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
  "20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"
];
const TURNOS = ["Selecione…","A","B","C"];
const AREAS = ["Selecione…","Adm","Agr","Alm","Aut","Biogás","E2G","Ind"];
const OBSERVACOES = [
  "Selecione…",
  "Condição estrutural do equipamento","Condição estrutural do local",
  "Construção civil","COVID","Descarte de lixo","Direção segura",
  "Elevação e movimentação de carga","Espaço Confinado","LOTO",
  "Meio Ambiente - Fumaça Preta","Meio Ambiente - Resíduos",
  "Meio Ambiente - Vazamentos","Meio Ambiente - Vinhaça",
  "Mov. cargas e interface Homem Máquina","Permissão de Serviços e procedimentos",
  "Regra dos três pontos","Segurança de processo (Aplicável na Indústria)",
  "Serviço elétrico","Serviços a quente","Trabalho em Altura",
  "Uso de EPIS","5S"
];

/** ====== CHAVES E LIMITES DIÁRIOS (sem mostrar nomes na UI) ====== */
const KEY_LIMITS: Record<string, number> = {
  "TheMito10": 10,
  "TheMito50*": 50,
  "TheMito100#": 100,
};
const normalizeKey = (k: string) => k.trim();

/** ============== HELPERS ============== */
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const ymdToBr = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const backDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
};

/** ============== FORM COMPONENT ============== */
type FormData = {
  classificacao: string;
  empresa: string;
  unidade: string;
  data: string; // dd/mm/yyyy
  hora: string;
  turno: string;
  area: string;
  setor: string;
  atividade: string;
  intervencao: string;
  cs: string;
  observacao: string;
  descricao: string;
  fiz: string;
  // chave
  key: string;
};

const emptyForm: FormData = {
  classificacao: CLASSIFICACOES[0],
  empresa: EMPRESAS[0],
  unidade: UNIDADES[0],
  data: ymdToBr(new Date()),
  hora: HORAS[0],
  turno: TURNOS[0],
  area: AREAS[0],
  setor: "",
  atividade: "",
  intervencao: "",
  cs: "",
  observacao: OBSERVACOES[0],
  descricao: "",
  fiz: "",
  key: "",
};

export default function PreEnvioForms() {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {}
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");

  /** ====== USO DIÁRIO POR CHAVE ====== */
  const limit = useMemo(() => {
    const k = normalizeKey(form.key);
    return KEY_LIMITS[k] ?? 0;
  }, [form.key]);
  const usedToday = useMemo(() => {
    const k = normalizeKey(form.key);
    if (!k) return 0;
    const key = `usage:${k}:${todayStr()}`;
    return Number(localStorage.getItem(key) || "0");
  }, [form.key]);

  const setUsedToday = (value: number) => {
    const k = normalizeKey(form.key);
    if (!k) return;
    const key = `usage:${k}:${todayStr()}`;
    localStorage.setItem(key, String(value));
  };

  /** ====== CHANGE HANDLER ====== */
  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
  };

  /** ====== VALIDAÇÃO ====== */
  const validate = (payload: FormData) => {
    const err: Partial<Record<keyof FormData, string>> = {};
    const req = (field: keyof FormData) => {
      if (!payload[field] || String(payload[field]).trim() === "" ||
          ["Selecione…"].includes(String(payload[field]))) {
        err[field] = "Esta pergunta é obrigatória.";
      }
    };
    req("key");
    req("classificacao");
    req("empresa");
    req("unidade");
    req("data");
    req("hora");
    req("turno");
    req("area");
    req("setor");
    req("atividade");
    req("intervencao");
    req("cs");
    req("observacao");
    req("descricao");
    req("fiz");

    // extra: CS numérico 10..999999999
    if (!err.cs) {
      const n = Number(payload.cs);
      if (!/^\d+$/.test(payload.cs) || n < 10 || n > 999999999) {
        err.cs = "Esta pergunta é obrigatória.";
      }
    }

    // chave válida?
    const k = normalizeKey(payload.key);
    if (!err.key && !KEY_LIMITS[k]) {
      err.key = "Chave inválida.";
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  /** ====== SALVAR PACOTE (API Vercel → GitHub) ====== */
  const saveOne = async (payload: any) => {
    setStep("Salvando pacote na hospedagem…");
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Falha ao salvar");
    }
    return data;
  };

  /** ====== GERAR 1x ====== */
  const gerar1 = async () => {
    if (!validate(form)) return;
    if (limit <= 0) {
      setErrors((e) => ({ ...e, key: "Chave inválida." }));
      return;
    }
    if (usedToday >= limit) {
      setStep(`Limite diário atingido (${usedToday}/${limit}).`);
      return;
    }

    setRunning(true);
    setProgress(5);
    try {
      setStep("Preparando pacote (1x) …");
      const payload = {
        tipo: "preenvio",
        quando: new Date().toISOString(),
        simulated: true,
        form,
      };
      setProgress(40);
      await saveOne(payload);
      setProgress(100);
      setStep("Pronto! Seu formulário será enviado posteriormente.");
      setUsedToday(usedToday + 1);
    } catch (e: any) {
      setStep(String(e.message || e));
    } finally {
      setTimeout(() => setRunning(false), 600);
    }
  };

  /** ====== GERAR 10x (retrocedendo datas) ====== */
  const gerar10 = async () => {
    if (!validate(form)) return;
    if (limit <= 0) {
      setErrors((e) => ({ ...e, key: "Chave inválida." }));
      return;
    }
    const disponiveis = Math.max(0, limit - usedToday);
    if (disponiveis <= 0) {
      setStep(`Limite diário atingido (${usedToday}/${limit}).`);
      return;
    }

    const toSend = Math.min(10, disponiveis);
    setRunning(true);
    setProgress(0);
    try {
      for (let i = 0; i < toSend; i++) {
        setStep(`Gerando ${i + 1}/${toSend} (data retro: ${ymdToBr(backDate(i))}) …`);
        const payload = {
          tipo: "preenvio",
          quando: new Date().toISOString(),
          simulated: true,
          form: { ...form, data: ymdToBr(backDate(i)) },
        };
        await saveOne(payload);
        setProgress(Math.round(((i + 1) / toSend) * 100));
      }
      setUsedToday(usedToday + toSend);
      setStep(`Pronto! Gerados ${toSend} pacotes. Seu formulário será enviado posteriormente.`);
    } catch (e: any) {
      setStep(String(e.message || e));
    } finally {
      setTimeout(() => setRunning(false), 600);
    }
  };

  /** ====== UI ====== */
  const exampleDates10 = Array.from({ length: 3 }, (_, i) => ymdToBr(backDate(i))).join(", ");

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 bg-gray-900/90 backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-lg font-semibold">Pré-envio de Formulários</h1>
          <p className="text-xs text-gray-300">
            Seu formulário será enviado posteriormente.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-16">
        {/* Campo da chave (sem citar nomes das chaves) */}
        <div className="mt-5">
          <Field label="Insira sua chave">
            <input
              name="key"
              value={form.key}
              onChange={onChange}
              className="input"
              placeholder="Insira sua chave"
              inputMode="text"
              autoComplete="off"
            />
            <Error text={errors.key} />
          </Field>
          <div className="text-xs text-gray-300">
            Hoje: {usedToday}/{limit || 0}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Field label="1. Classificação">
            <select name="classificacao" value={form.classificacao} onChange={onChange} className="select">
              {CLASSIFICACOES.map((v) => <option key={v}>{v}</option>)}
            </select>
            <Error text={errors.classificacao} />
          </Field>

          <Field label="2. Empresa">
            <select name="empresa" value={form.empresa} onChange={onChange} className="select">
              {EMPRESAS.map((v) => <option key={v}>{v}</option>)}
            </select>
            <Error text={errors.empresa} />
          </Field>

          <Field label="3. Unidade">
            <select name="unidade" value={form.unidade} onChange={onChange} className="select">
              {UNIDADES.map((v) => <option key={v}>{v}</option>)}
            </select>
            <Error text={errors.unidade} />
          </Field>

          <Field label="4. Data">
            <input
              name="data"
              value={form.data}
              onChange={onChange}
              className="input"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
            />
            <Error text={errors.data} />
          </Field>

          <Field label="5. Hora">
            <select name="hora" value={form.hora} onChange={onChange} className="select">
              {HORAS.map((v) => <option key={v}>{v}</option>)}
            </select>
            <Error text={errors.hora} />
          </Field>

          <Field label="6. Turno">
            <select name="turno" value={form.turno} onChange={onChange} className="select">
              {TURNOS.map((v) => <option key={v}>{v}</option>)}
            </select>
            <Error text={errors.turno} />
          </Field>

          <Field label="7. Área onde a intervenção foi realizada">
            <select name="area" value={form.area} onChange={onChange} className="select">
              {AREAS.map((v) => <option key={v}>{v}</option>)}
            </select>
            <Error text={errors.area} />
          </Field>

          <Field label="8. Setor onde a intervenção foi realizada">
            <input
              name="setor"
              value={form.setor}
              onChange={onChange}
              className="input"
              placeholder="Informe o setor"
            />
            <Error text={errors.setor} />
          </Field>

          <Field label="9. Atividade realizada no momento da intervenção">
            <input
              name="atividade"
              value={form.atividade}
              onChange={onChange}
              className="input"
              placeholder="Descreva a atividade"
            />
            <Error text={errors.atividade} />
          </Field>

          <Field label="10. Intervenção realizada por">
            <input
              name="intervencao"
              value={form.intervencao}
              onChange={onChange}
              className="input"
              placeholder="Nome/Equipe"
            />
            <Error text={errors.intervencao} />
          </Field>

          <Field label="11. CS (somente o número)">
            <input
              name="cs"
              value={form.cs}
              onChange={onChange}
              className="input"
              placeholder="entre 10 e 999999999"
              inputMode="numeric"
            />
            <Error text={errors.cs} />
          </Field>

          <Field label="12. O que observei?">
            <select name="observacao" value={form.observacao} onChange={onChange} className="select">
              {OBSERVACOES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.observacao} />
          </Field>

          <Field label="13. Breve descrição do que foi observado">
            <textarea
              name="descricao"
              value={form.descricao}
              onChange={onChange}
              className="textarea"
              placeholder="Descreva brevemente"
            />
            <Error text={errors.descricao} />
          </Field>

          <Field label="14. O que eu fiz a respeito?">
            <textarea
              name="fiz"
              value={form.fiz}
              onChange={onChange}
              className="textarea"
              placeholder="Explique sua ação"
            />
            <Error text={errors.fiz} />
          </Field>

          {/* BOTÕES */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              title="Gera um pacote (1x). Seu formulário será enviado posteriormente."
              onClick={gerar1}
              disabled={running}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar pacote (1x)
            </button>

            <button
              title={`Gera 10 entradas retrocedendo a data (ex.: ${exampleDates10}).`}
              onClick={gerar10}
              disabled={running}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar lote (10x)
            </button>

            <div className="text-xs text-gray-300 self-center sm:ml-auto">
              Hoje: {usedToday}/{limit || 0}
            </div>
          </div>

          {/* PROGRESSO */}
          {running && (
            <div className="mt-4">
              <div className="h-2 bg-gray-700 rounded">
                <div className="h-2 bg-indigo-500 rounded transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-gray-300 mt-2">{step}</div>
            </div>
          )}
        </div>
      </main>

      {/* utilitários inline (mobile-first) */}
      <style>{`
        .input { width:100%; padding:0.6rem 0.75rem; border-radius:0.5rem; background:#374151; outline:none; }
        .select { width:100%; padding:0.6rem 0.75rem; border-radius:0.5rem; background:#374151; outline:none; }
        .textarea { width:100%; min-height:100px; padding:0.6rem 0.75rem; border-radius:0.5rem; background:#374151; outline:none; }
      `}</style>
    </div>
  );
}

/** ========= SUBCOMPONENTES ========= */
function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-gray-300">{props.label}</div>
      {props.children}
    </div>
  );
}
function Error({ text }: { text?: string }) {
  if (!text) return null;
  return <div className="text-red-400 text-xs mt-1">{text}</div>;
}
