import React, { useEffect, useMemo, useRef, useState } from "react";

/** ========= LICENÇAS =========
 * Chaves aceitas (case-insensitive):
 *  - TheMito10    → limite diário: 10
 *  - TheMito50*   → limite diário: 50
 *  - TheMito100#  → limite diário: 100
 * A validação bloqueia o formulário até a chave ser aceita.
 * O limite é por dispositivo/navegador e reinicia a cada dia.
 */
const LICENSES: Record<string, number> = {
  "THEMITO10": 10,
  "THEMITO50*": 50,
  "THEMITO100#": 100,
};

const LS_KEYS = {
  usedCounter: "pef_used_counter",           // { date: "YYYY-MM-DD", used: number }
  license: "pef_license",                    // { key: string, limit: number, validatedAt: ISO }
  savedSetores: "pef_saved_setores",         // string[]
  savedAtividades: "pef_saved_atividades",   // string[]
};

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadJSON<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(k: string, v: unknown) {
  localStorage.setItem(k, JSON.stringify(v));
}

function upsertToArray(arr: string[], value: string, max = 50) {
  const v = value.trim();
  if (!v) return arr.slice();
  const exists = arr.some((x) => x.toLowerCase() === v.toLowerCase());
  const next = exists ? arr.slice() : [v, ...arr];
  return next.slice(0, max);
}

/** ========= LISTAS E OPÇÕES ========= */
const CLASSIFICACOES = ["Quase acidente", "Comportamento inseguro", "Condição insegura"] as const;
const EMPRESAS = ["Raízen", "Contratada"] as const;

// Unidades (inclui "Vale do Rosário")
const UNIDADES = [
  "Araraquara","Barra","Benalcool","Bonfim","Caarapó","Continental","Costa Pinto",
  "Destivale","Diamante","Dois Córregos","Gasa","Ipaussu","Jataí","Junqueira",
  "Lagoa da Prata","Leme","Maracaí","MB","Mundial","Paraguaçú","Paraíso",
  "Passa Tempo","Rafard","Rio Brilhante","Santa Cândida","Santa Elisa",
  "Santa Helena","São Francisco","Serra","Tarumã","Univalem","Vale do Rosário"
];

const TURNOS = ["A", "B", "C"] as const;
const AREAS = ["Adm", "Agr", "Alm", "Aut", "Biogás", "E2G", "Ind"] as const;

const HORAS = (() => {
  const r: string[] = [];
  for (let h = 0; h < 24; h++) for (let m of [0, 30]) r.push(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
  return r;
})();

const OBSERVACOES = [
  "Condição estrutural do equipamento","Condição estrutural do local",
  "Construção civil","COVID","Descarte de lixo","Direção segura",
  "Elevação e movimentação de carga","Espaço Confinado","LOTO",
  "Meio Ambiente - Fumaça Preta","Meio Ambiente - Resíduos",
  "Meio Ambiente - Vazamentos","Meio Ambiente - Vinhaça",
  "Mov. cargas e interface Homem Máquina","Permissão de Serviços e procedimentos",
  "Regra dos três pontos","Segurança de processo (Aplicável na Indústria)",
  "Serviço elétrico","Serviços a quente","Trabalho em Altura",
  "Uso de EPIs","5S"
];

/** ========= COMPONENTE ========= */
export default function PreEnvioForms() {
  // ----- Licença / Limites
  const [licenseKey, setLicenseKey] = useState("");
  const [dailyLimit, setDailyLimit] = useState<number>(10);
  const [usedToday, setUsedToday] = useState<number>(0);
  const [locked, setLocked] = useState(true);

  // ----- Saved lists (localStorage)
  const [savedSetores, setSavedSetores] = useState<string[]>([]);
  const [savedAtividades, setSavedAtividades] = useState<string[]>([]);
  const [saveSetor, setSaveSetor] = useState(false);
  const [saveAtividade, setSaveAtividade] = useState(false);

  // ----- Form
  const [form, setForm] = useState({
    classificacao: CLASSIFICACOES[0],
    empresa: EMPRESAS[0],
    unidade: "Vale do Rosário",
    data: toBRDate(new Date()),
    hora: "08:00",
    turno: "A",
    area: "Adm",
    setor: "",
    atividade: "",
    intervencao: "",
    cs: "",
    observacao: OBSERVACOES[0],
    descricao: "",
    fiz: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");

  // exemplo de datas para tooltip do botão 10x
  const exampleDates10 = useMemo(() => {
    const base = new Date();
    const pp = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      pp.push(toBRDate(d));
    }
    return pp.join(", ");
  }, []);

  // ----- Efeitos iniciais: carrega licença / contador / listas salvas
  useEffect(() => {
    // license
    const lic = loadJSON<{ key: string; limit: number; validatedAt: string } | null>(LS_KEYS.license, null);
    if (lic && lic.limit && lic.key) {
      setLicenseKey(lic.key);
      setDailyLimit(lic.limit);
      setLocked(false);
    }

    // counter
    const saved = loadJSON<{ date: string; used: number } | null>(LS_KEYS.usedCounter, null);
    const today = todayKey();
    if (saved && saved.date === today) {
      setUsedToday(saved.used);
    } else {
      saveJSON(LS_KEYS.usedCounter, { date: today, used: 0 });
      setUsedToday(0);
    }

    // lists
    setSavedSetores(loadJSON<string[]>(LS_KEYS.savedSetores, []));
    setSavedAtividades(loadJSON<string[]>(LS_KEYS.savedAtividades, []));
  }, []);

  // ----- Handlers
  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function validateAll(): boolean {
    const e: typeof errors = {};
    // required de todos os campos
    (Object.keys(form) as (keyof typeof form)[]).forEach((k) => {
      if (String(form[k]).trim() === "") e[k] = "Esta pergunta é obrigatória.";
    });
    // regras extras
    const n = Number(form.cs);
    if (!Number.isFinite(n) || n < 10 || n > 999999999) {
      e.cs = "Esta pergunta é obrigatória.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function updateUsed(add: number) {
    const today = todayKey();
    const used = Math.min(dailyLimit, usedToday + add);
    setUsedToday(used);
    saveJSON(LS_KEYS.usedCounter, { date: today, used });
  }

  function persistSavedListsIfChecked() {
    let nextSetores = savedSetores.slice();
    let nextAtivs = savedAtividades.slice();

    if (saveSetor && form.setor.trim()) nextSetores = upsertToArray(nextSetores, form.setor);
    if (saveAtividade && form.atividade.trim()) nextAtivs = upsertToArray(nextAtivs, form.atividade);

    if (nextSetores !== savedSetores) {
      setSavedSetores(nextSetores);
      saveJSON(LS_KEYS.savedSetores, nextSetores);
    }
    if (nextAtivs !== savedAtividades) {
      setSavedAtividades(nextAtivs);
      saveJSON(LS_KEYS.savedAtividades, nextAtivs);
    }
  }

  async function gerar(lote10: boolean) {
    if (locked) return;
    if (!validateAll()) return;

    const total = lote10 ? 10 : 1;
    if (usedToday + total > dailyLimit) {
      alert(`Limite diário atingido. Hoje: ${usedToday}/${dailyLimit}.`);
      return;
    }

    // Salva nas listas pessoais, se marcado
    persistSavedListsIfChecked();

    setRunning(true);
    setProgress(0);
    setStep("Preparando…");

    try {
      // monta os registros
      const registros = [];
      for (let i = 0; i < total; i++) {
        const retroData = lote10 ? dateMinus(form.data, i) : form.data;
        registros.push({
          ...form,
          data: retroData,
          _generatedAt: new Date().toISOString(),
          _batchIndex: i + 1,
        });
      }

      // envia 1 a 1 para a API /api/save
      for (let i = 0; i < registros.length; i++) {
        setStep(`Salvando ${i + 1}/${registros.length}…`);
        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registros[i]),
        });
        if (!res.ok) throw new Error(`Falha ao salvar (${i + 1})`);
        const pct = Math.round(((i + 1) / registros.length) * 100);
        setProgress(pct);
      }

      updateUsed(total);
      setStep("Concluído!");
      setTimeout(() => setRunning(false), 600);

    } catch (err) {
      console.error(err);
      setStep("Erro ao salvar. Tente novamente.");
      setRunning(false);
    }
  }

  function validateLicense() {
    const key = licenseKey.trim().toUpperCase();
    const limit = LICENSES[key];
    if (!limit) {
      alert("Chave inválida.");
      setLocked(true);
      return;
    }
    setDailyLimit(limit);
    setLocked(false);
    saveJSON(LS_KEYS.license, { key, limit, validatedAt: new Date().toISOString() });

    // zera contador do dia ao validar chave (opcional: comente se não quiser)
    saveJSON(LS_KEYS.usedCounter, { date: todayKey(), used: 0 });
    setUsedToday(0);
  }

  // ----- UI
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Pré-envio de Formulários</h1>
          <div className="text-xs text-gray-300">Hoje: {usedToday}/{dailyLimit}</div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-xl px-4 py-6">
        {/* BLOQUEIO: tela de chave */}
        {locked && (
          <div className="mb-6 rounded-xl border border-white/10 p-4 bg-gray-800">
            <div className="text-sm mb-2">Insira sua <b>chave</b> para liberar o formulário.</div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-md bg-gray-700 outline-none"
                placeholder="Insira sua chave"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                inputMode="text"
                autoCapitalize="characters"
              />
              <button
                className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500"
                onClick={validateLicense}
              >
                Validar
              </button>
            </div>
            <div className="text-xs text-gray-300 mt-2">
              Chave válida exibe: <b>{dailyLimit}/{dailyLimit}</b> de limite diário.
            </div>
          </div>
        )}

        {/* FORMULÁRIO */}
        <div className={`space-y-4 ${locked ? "pointer-events-none opacity-50" : ""}`}>
          <p className="text-sm text-gray-300">
            Seu formulário será enviado posteriormente.
          </p>

          <Field label="1. Classificação">
            <select name="classificacao" value={form.classificacao} onChange={onChange} className="select">
              {CLASSIFICACOES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.classificacao} />
          </Field>

          <Field label="2. Empresa">
            <select name="empresa" value={form.empresa} onChange={onChange} className="select">
              {EMPRESAS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.empresa} />
          </Field>

          <Field label="3. Unidade">
            <select name="unidade" value={form.unidade} onChange={onChange} className="select">
              {UNIDADES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.unidade} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
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
                {HORAS.map((h) => <option key={h}>{h}</option>)}
              </select>
              <Error text={errors.hora} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="6. Turno">
              <select name="turno" value={form.turno} onChange={onChange} className="select">
                {TURNOS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <Error text={errors.turno} />
            </Field>
            <Field label="7. Área onde a intervenção foi realizada">
              <select name="area" value={form.area} onChange={onChange} className="select">
                {AREAS.map((a) => <option key={a}>{a}</option>)}
              </select>
              <Error text={errors.area} />
            </Field>
          </div>

          {/* Setor com autocomplete + checkbox salvar */}
          <Field label="8. Setor onde a intervenção foi realizada">
            <input
              name="setor"
              value={form.setor}
              onChange={onChange}
              className="input"
              placeholder="Informe o setor"
              list="setorOptions"
              autoComplete="off"
            />
            <datalist id="setorOptions">
              {savedSetores.map((s) => <option key={s} value={s} />)}
            </datalist>

            <label className="mt-2 flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={saveSetor}
                onChange={(e) => setSaveSetor(e.target.checked)}
              />
              Salvar este setor na minha lista
            </label>
            <Error text={errors.setor} />
          </Field>

          {/* Atividade com autocomplete + checkbox salvar */}
          <Field label="9. Atividade realizada no momento da intervenção">
            <input
              name="atividade"
              value={form.atividade}
              onChange={onChange}
              className="input"
              placeholder="Descreva a atividade"
              list="atividadeOptions"
              autoComplete="off"
            />
            <datalist id="atividadeOptions">
              {savedAtividades.map((s) => <option key={s} value={s} />)}
            </datalist>

            <label className="mt-2 flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={saveAtividade}
                onChange={(e) => setSaveAtividade(e.target.checked)}
              />
              Salvar esta atividade na minha lista
            </label>
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
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              title="Gera um pacote (1x). Seu formulário será enviado posteriormente."
              onClick={() => gerar(false)}
              disabled={running || locked}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar pacote (1x)
            </button>

            <button
              title={`Gera 10 entradas retrocedendo a data (ex.: ${exampleDates10}).`}
              onClick={() => gerar(true)}
              disabled={running || locked}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar lote (10x)
            </button>

            <div className="text-sm text-gray-300 self-center">
              Hoje: {usedToday}/{dailyLimit}
            </div>
          </div>

          {/* PROGRESSO */}
          {running && (
            <div className="mt-6">
              <div className="h-2 bg-gray-700 rounded">
                <div className="h-2 bg-indigo-500 rounded transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-gray-300 mt-2">{step}</div>
            </div>
          )}
        </div>
      </main>

      {/* utilitários inline */}
      <style>{`
        .input { width:100%; padding:0.625rem 0.75rem; border-radius:0.5rem; background:#374151; outline:none; }
        .select { width:100%; padding:0.625rem 0.75rem; border-radius:0.5rem; background:#374151; outline:none; }
        .textarea { width:100%; min-height:96px; padding:0.625rem 0.75rem; border-radius:0.5rem; background:#374151; outline:none; }
      `}</style>
    </div>
  );
}

/** ========= SUBCOMPONENTES ========= */
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

/** ========= HELPERS ========= */
function toBRDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function dateMinus(brDate: string, minusDays: number) {
  // brDate no formato dd/mm/yyyy
  const [dd, mm, yyyy] = brDate.split("/").map((x) => parseInt(x, 10));
  const d = new Date(yyyy, (mm ?? 1) - 1, dd ?? 1);
  d.setDate(d.getDate() - minusDays);
  return toBRDate(d);
}
