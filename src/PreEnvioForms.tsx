import React, { useMemo, useState } from "react";

/** ================== LISTAS ================== */
const CLASSIFICACOES = [
  "Quase acidente",
  "Condição insegura",
  "Ato inseguro",
  "Outro",
];

const EMPRESAS = ["Raízen", "Terceiros", "Outra"];
const UNIDADES = ["Vale do Rosário", "Unidade A", "Unidade B"];
const TURNOS = ["A", "B", "C", "ADM"];
const AREAS = ["Administrativo", "Operacional", "Manutenção", "Segurança"];
const OBSERVACOES = [
  "Uso incorreto de EPI",
  "Armazenamento inadequado",
  "Sinalização ausente",
  "Ordem e limpeza",
  "Outra",
];

/** ================== TIPOS ================== */
type Form = {
  classificacao: string;
  empresa: string;
  unidade: string;
  data: string; // yyyy-mm-dd
  hora: string; // HH:mm
  turno: string;
  area: string;
  setor: string;
  atividade: string;
  por: string;
  cs: string; // número string
  observacao: string;
  descricao: string;
  fiz: string;
};

type Errors = Partial<Record<keyof Form, string>>;

/** Util: hoje em yyyy-mm-dd */
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ================== COMPONENTE ================== */
export default function PreEnvioForms() {
  /** ---------- estado do formulário ---------- */
  const [form, setForm] = useState<Form>({
    classificacao: "",
    empresa: "",
    unidade: "",
    data: todayISO(),
    hora: "08:00",
    turno: "A",
    area: "",
    setor: "",
    atividade: "",
    por: "",
    cs: "",
    observacao: "",
    descricao: "",
    fiz: "",
  });

  const [errors, setErrors] = useState<Errors>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");

  /** ---------- CHAVE / LIMITE POR DIA ---------- */
  const [licKey, setLicKey] = useState("");
  const [licStatus, setLicStatus] = useState<null | {
    ok: boolean;
    msg: string;
    id?: string;
    limit?: number;
  }>(null);
  const [dailyLimit, setDailyLimit] = useState<number>(0);
  const [used, setUsed] = useState<number>(0);

  const todayStr = useMemo(() => todayISO(), []);

  function keyInfo(key: string) {
    const k = key.trim();
    if (/^themito10$/i.test(k)) return { valid: true, id: "TheMito10", limit: 10 as const };
    if (/^themito50\*$/i.test(k)) return { valid: true, id: "TheMito50*", limit: 50 as const };
    if (/^themito100#$/i.test(k)) return { valid: true, id: "TheMito100#", limit: 100 as const };
    return { valid: false as const };
  }

  function usageKey(id: string) {
    return `usage:${id}:${todayStr}`;
  }

  function loadUsage(id: string) {
    const val = Number(localStorage.getItem(usageKey(id)) || "0");
    setUsed(isNaN(val) ? 0 : val);
  }

  function saveUsage(id: string, value: number) {
    localStorage.setItem(usageKey(id), String(value));
    setUsed(value);
  }

  function validarChave() {
    const info = keyInfo(licKey);
    if (!info.valid) {
      setLicStatus({ ok: false, msg: "Chave inválida." });
      setDailyLimit(0);
      setUsed(0);
      return;
    }
    setLicStatus({
      ok: true,
      msg: `Chave válida. Limite diário: ${info.limit}.`,
      id: info.id,
      limit: info.limit,
    });
    setDailyLimit(info.limit!);
    loadUsage(info.id!);
  }

  /** ---------- handlers ---------- */
  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
  }

  /** validação obrigatória + CS número */
  function validate(): boolean {
    const e: Errors = {};
    const req: (keyof Form)[] = [
      "classificacao",
      "empresa",
      "unidade",
      "data",
      "hora",
      "turno",
      "area",
      "setor",
      "atividade",
      "por",
      "cs",
      "observacao",
      "descricao",
      "fiz",
    ];
    req.forEach((k) => {
      const v = (form[k] ?? "").toString().trim();
      if (!v) e[k] = "Esta pergunta é obrigatória.";
    });
    // CS numérico entre 10 e 999999999
    const csn = Number(form.cs);
    if (!Number.isFinite(csn) || csn < 10 || csn > 999999999) {
      e.cs = "Informe um número entre 10 e 999999999.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /** gera entradas e envia para API /api/save (salva no GitHub) */
  async function gerar(isLote: boolean) {
    const countToUse = isLote ? 10 : 1;

    if (!licStatus?.ok || !licStatus.id || !dailyLimit) {
      alert("Valide uma chave primeiro.");
      return;
    }

    const remaining = dailyLimit - used;
    if (remaining <= 0) {
      alert("Limite diário atingido para esta chave.");
      return;
    }
    if (countToUse > remaining) {
      alert(`Restam apenas ${remaining} envios hoje para esta chave.`);
      return;
    }

    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setRunning(true);
    setProgress(0);
    setStep("Preparando…");

    try {
      // monta as N entradas (retrocedendo a data no modo 10x)
      const items: any[] = [];
      for (let i = 0; i < countToUse; i++) {
        const d = new Date(form.data);
        d.setDate(d.getDate() - (isLote ? i : 0));
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dataISO = `${yyyy}-${mm}-${dd}`;

        items.push({
          ...form,
          data: dataISO,
          _meta: {
            origem: "preenvio",
            createdAt: new Date().toISOString(),
            chave: licStatus.id,
            lote: isLote,
          },
        });
      }

      // envia uma a uma para a API
      for (let i = 0; i < items.length; i++) {
        setStep(`Salvando ${i + 1} de ${items.length}…`);
        const r = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(items[i]),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Falha ao salvar.");
        setProgress(Math.round(((i + 1) / items.length) * 100));
      }

      saveUsage(licStatus.id!, used + countToUse);
      setStep("Concluído!");
      alert(`${countToUse} registro(s) salvo(s) com sucesso.`);
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err?.message || err}`);
    } finally {
      setRunning(false);
      setTimeout(() => setStep(""), 1500);
    }
  }

  /** exemplo de datas mostradas no tooltip do botão 10x */
  const exampleDates10 = useMemo(() => {
    const base = new Date(form.data || todayStr);
    const arr: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      arr.push(`${dd}/${mm}/${yyyy}`);
    }
    return `${arr[0]}, ${arr[1]}, ${arr[2]}…`;
  }, [form.data, todayStr]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <header className="max-w-5xl mx-auto px-4 pt-8 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Pré-envio de Formulários</h1>
          <span className="text-xs rounded-full border border-yellow-600/70 px-3 py-1 text-yellow-400">
            simulação / não enviado
          </span>
        </div>
        <div className="text-sm text-gray-300 mt-2">Seu formulário será enviado posteriormente.</div>

        {/* Barra da chave */}
        <div className="mt-4 rounded-lg bg-slate-800/60 p-3">
          <div className="flex gap-2">
            <input
              value={licKey}
              onChange={(e) => setLicKey(e.target.value)}
              placeholder="Insira a chave (ex.: TheMito10, TheMito50*, TheMito100#)"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={validarChave}
              className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500"
            >
              Validar chave
            </button>
          </div>
          {licStatus && (
            <div className={`mt-2 text-sm ${licStatus.ok ? "text-emerald-400" : "text-red-400"}`}>
              {licStatus.msg} {licStatus.ok && "(renova diariamente)"}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-14">
        <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/40 p-4">
          {/* 1 */}
          <Field label="1. Classificação">
            <select name="classificacao" value={form.classificacao} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {CLASSIFICACOES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <Error text={errors.classificacao} />
          </Field>

          {/* 2 */}
          <Field label="2. Empresa">
            <select name="empresa" value={form.empresa} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {EMPRESAS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <Error text={errors.empresa} />
          </Field>

          {/* 3 */}
          <Field label="3. Unidade">
            <select name="unidade" value={form.unidade} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {UNIDADES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <Error text={errors.unidade} />
          </Field>

          {/* 4 */}
          <Field label="4. Data">
            <input type="date" name="data" value={form.data} onChange={onChange} className="input" />
            <Error text={errors.data} />
          </Field>

          {/* 5 */}
          <Field label="5. Hora">
            <input type="time" name="hora" value={form.hora} onChange={onChange} className="input" />
            <Error text={errors.hora} />
          </Field>

          {/* 6 */}
          <Field label="6. Turno">
            <select name="turno" value={form.turno} onChange={onChange} className="select">
              {TURNOS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <Error text={errors.turno} />
          </Field>

          {/* 7 */}
          <Field label="7. Área onde a intervenção foi realizada">
            <select name="area" value={form.area} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {AREAS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <Error text={errors.area} />
          </Field>

          {/* 8 */}
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

          {/* 9 */}
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

          {/* 10 */}
          <Field label="10. Intervenção realizada por">
            <input name="por" value={form.por} onChange={onChange} className="input" placeholder="Nome/Equipe" />
            <Error text={errors.por} />
          </Field>

          {/* 11 */}
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

          {/* 12 */}
          <Field label="12. O que observei?">
            <select name="observacao" value={form.observacao} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {OBSERVACOES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <Error text={errors.observacao} />
          </Field>

          {/* 13 */}
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

          {/* 14 */}
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
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              title="Gera um pacote (1x). Seu formulário será enviado posteriormente."
              onClick={() => gerar(false)}
              disabled={running || !licStatus?.ok}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar pacote (1x)
            </button>

            <button
              title={`Gera 10 entradas retrocedendo a data (ex.: ${exampleDates10}).`}
              onClick={() => gerar(true)}
              disabled={running || !licStatus?.ok}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar lote (10x)
            </button>

            <div className="text-sm text-gray-300 self-center">
              {licStatus?.ok ? `Hoje: ${used}/${dailyLimit}` : "Valide a chave para liberar o envio"}
            </div>
          </div>

          {/* PROGRESSO */}
          {running && (
            <div className="mt-6">
              <div className="h-2 bg-gray-700 rounded">
                <div
                  className="h-2 bg-indigo-500 rounded transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-300 mt-2">{step}</div>
            </div>
          )}
        </div>
      </main>

      {/* utilitários inline (combinam com Tailwind) */}
      <style>{`
        .input { width:100%; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
        .select { width:100%; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
        .textarea { width:100%; min-height:90px; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
      `}</style>
    </div>
  );
}

/** ======= SUBCOMPONENTES ======= */
function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm text-gray-300">{props.label}</div>
      {props.children}
    </div>
  );
}

function Error({ text }: { text?: string }) {
  if (!text) return null;
  return <div className="text-red-400 text-xs mt-1">{text}</div>;
}
