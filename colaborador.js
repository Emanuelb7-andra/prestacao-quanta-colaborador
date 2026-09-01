const cadastros = window.CADASTROS;
const STORAGE_KEY = "fortes-reembolso-colaborador-v2";

const state = {
  meta: {
    vencimento: "2026-06-10",
    fornecedorPadrao: "REEMBOLSO REEMBOLSO",
  },
  entries: [],
};

const el = (id) => document.getElementById(id);

const fields = {
  nome: el("nome"),
  cargo: el("cargo"),
  cpf: el("cpf"),
  banco: el("banco"),
  conta: el("conta"),
  pix: el("pix"),
};

const formFields = {
  data: el("data"),
  descricao: el("descricao"),
  despesa: el("despesa"),
  centro: el("centro"),
  fornecedor: el("fornecedor"),
  fornecedorDoc: el("fornecedorDoc"),
  documento: el("documento"),
  valor: el("valor"),
};

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function expenseCodeForTxt(code) {
  return String(code || "").replace(/\D/g, "");
}

function formatDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function monthYear(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return "";
  const [year, month] = isoDate.split("-");
  return `${month}/${year}`;
}

function money(value) {
  const n = Number(value || 0);
  return n.toFixed(2).replace(".", ",");
}

function brl(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function entryPeriod() {
  const dates = state.entries
    .map((entry) => entry.data)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date || ""))
    .sort();
  return {
    from: dates[0] || "",
    to: dates[dates.length - 1] || "",
  };
}

function findByName(list, name) {
  const target = normalize(name);
  return list.find((item) => normalize(item.nome) === target);
}

function getFornecedorPadrao() {
  return cadastros.fornecedores.find((f) => f.codigo === "003699") || cadastros.fornecedores[0];
}

function fillDatalists() {
  const despesasList = el("despesasList");
  const centrosList = el("centrosList");
  const fornecedoresList = el("fornecedoresList");

  const saidas = cadastros.despesas.filter((d) => d.natureza === "Saída");
  if (despesasList) {
    despesasList.innerHTML = saidas
      .map((d) => `<option value="${escapeHtml(d.nome)}">${escapeHtml(expenseCodeForTxt(d.codigo))}</option>`)
      .join("");
  }
  if (centrosList) {
    centrosList.innerHTML = cadastros.centros
      .map((c) => `<option value="${escapeHtml(c.nome)}">${escapeHtml(c.codigo)} - ${escapeHtml(c.status)}</option>`)
      .join("");
  }
  if (fornecedoresList) {
    fornecedoresList.innerHTML = cadastros.fornecedores
      .map((f) => `<option value="${escapeHtml(f.nome)}">${escapeHtml(f.codigo)} ${escapeHtml(f.cnpjCpf || "")}</option>`)
      .join("");
  }

  if (formFields.fornecedor) formFields.fornecedor.value = getFornecedorPadrao()?.nome || "";
}

function setupFilter(input, items, getLabel, getMeta) {
  if (!input || !input.parentElement) return;
  input.removeAttribute("list");
  input.autocomplete = "off";

  const list = document.createElement("div");
  list.className = "filter-list";
  input.parentElement.appendChild(list);

  let activeIndex = -1;
  let current = [];

  const close = () => {
    list.classList.remove("open");
    activeIndex = -1;
  };

  const open = () => {
    renderOptions();
    list.classList.add("open");
  };

  const pick = (item) => {
    input.value = getLabel(item);
    close();
    updateQuickInfo();
  };

  const renderOptions = () => {
    const term = normalize(input.value);
    current = items
      .filter((item) => {
        const haystack = normalize(`${getLabel(item)} ${getMeta(item)}`);
        return !term || haystack.includes(term);
      })
      .slice(0, 60);

    if (!current.length) {
      list.innerHTML = `<div class="filter-option"><span>Nenhum resultado</span><small>Revise o texto digitado.</small></div>`;
      return;
    }

    list.innerHTML = current
      .map((item, index) => {
        const active = index === activeIndex ? " active" : "";
        return `
          <button type="button" class="filter-option${active}" data-index="${index}">
            <span>${escapeHtml(getLabel(item))}</span>
            <small>${escapeHtml(getMeta(item))}</small>
          </button>
        `;
      })
      .join("");
  };

  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  input.addEventListener("input", () => {
    activeIndex = -1;
    open();
    updateQuickInfo();
  });
  input.addEventListener("keydown", (event) => {
    if (!list.classList.contains("open") && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      open();
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown") {
      activeIndex = Math.min(activeIndex + 1, current.length - 1);
      renderOptions();
      event.preventDefault();
    }
    if (event.key === "ArrowUp") {
      activeIndex = Math.max(activeIndex - 1, 0);
      renderOptions();
      event.preventDefault();
    }
    if (event.key === "Enter" && activeIndex >= 0 && current[activeIndex]) {
      pick(current[activeIndex]);
      event.preventDefault();
    }
    if (event.key === "Escape") close();
  });

  list.addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-index]");
    if (!button) return;
    pick(current[Number(button.dataset.index)]);
    event.preventDefault();
  });

  document.addEventListener("mousedown", (event) => {
    if (!input.parentElement.contains(event.target)) close();
  });
}

function setupFilters() {
  const saidas = cadastros.despesas.filter((d) => d.natureza === "Saída");
  setupFilter(
    formFields.despesa,
    saidas,
    (d) => d.nome,
    (d) => expenseCodeForTxt(d.codigo)
  );
  setupFilter(
    formFields.centro,
    cadastros.centros,
    (c) => c.nome,
    (c) => `${c.codigo} - ${c.status}`
  );
  setupFilter(
    formFields.fornecedor,
    cadastros.fornecedores,
    (f) => f.nome,
    (f) => `${f.codigo}${f.cnpjCpf ? ` - ${f.cnpjCpf}` : ""}`
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state.meta, saved.meta || {});
    state.entries = Array.isArray(saved.entries) ? saved.entries : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function writeStateToFields() {
  for (const [key, input] of Object.entries(fields)) {
    if (state.meta[key] !== undefined) input.value = state.meta[key];
  }
}

function readMetaFromFields() {
  for (const [key, input] of Object.entries(fields)) {
    state.meta[key] = input.value;
  }
}

function saveState() {
  readMetaFromFields();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function currentSelections() {
  const despesa = findByName(cadastros.despesas, formFields.despesa.value);
  const centro = findByName(cadastros.centros, formFields.centro.value);
  const fornecedor = findByName(cadastros.fornecedores, formFields.fornecedor.value);
  return { despesa, centro, fornecedor };
}

function updateQuickInfo() {
  const { despesa, centro, fornecedor } = currentSelections();
  const parts = [];
  if (despesa) parts.push(`Despesa: ${expenseCodeForTxt(despesa.codigo)} - ${despesa.nome}`);
  if (centro) parts.push(`Centro: ${centro.codigo} - ${centro.nome} (${centro.status})`);
  if (fornecedor) {
    parts.push(`Fornecedor: ${fornecedor.codigo} - ${fornecedor.cnpjCpf || "sem CNPJ/CPF"}`);
    if (formFields.fornecedorDoc) formFields.fornecedorDoc.value = fornecedor.cnpjCpf || "";
  } else if (formFields.fornecedor.value.trim()) {
    parts.push("Fornecedor novo: informe o CNPJ/CPF se tiver. Se deixar em branco, o TXT/CSV tambem fica em branco.");
  }
  el("quickInfo").textContent = parts.length
    ? parts.join(" | ")
    : `Cadastros carregados: ${cadastros.centros.length} centros, ${cadastros.despesas.length} receitas/despesas e ${cadastros.fornecedores.length} fornecedores. Clique nos campos Despesa, Centro de Custo ou Fornecedor para pesquisar.`;
}

function addEntry(event) {
  event.preventDefault();
  const { despesa, centro, fornecedor } = currentSelections();
  const errors = [];
  const fornecedorNome = fornecedor?.nome || formFields.fornecedor.value.trim();
  const fornecedorCnpjCpf = onlyDigits(fornecedor?.cnpjCpf || formFields.fornecedorDoc?.value);

  if (!despesa) errors.push("Despesa nao encontrada no cadastro oficial.");
  if (!centro) errors.push("Centro de custo nao encontrado no cadastro oficial.");
  if (!fornecedorNome) errors.push("Informe o fornecedor.");
  if (!formFields.data.value) errors.push("Informe a data.");
  if (!formFields.descricao.value.trim()) errors.push("Informe a descricao.");
  if (!(Number(formFields.valor.value) > 0)) errors.push("Informe valor positivo.");

  if (errors.length) {
    alert(errors.join("\n"));
    return;
  }

  state.entries.push({
    id: makeId(),
    data: formFields.data.value,
    descricao: formFields.descricao.value.trim(),
    despesaNome: despesa.nome,
    despesaCodigo: despesa.codigo,
    centroNome: centro.nome,
    centroCodigo: centro.codigo,
    centroStatus: centro.status,
    fornecedorNome,
    fornecedorCodigo: fornecedor?.codigo || "",
    fornecedorCnpjCpf,
    documento: formFields.documento.value.trim() || formFields.descricao.value.trim(),
    valor: Number(formFields.valor.value),
  });

  const keepFornecedor = formFields.fornecedor.value;
  const keepFornecedorDoc = formFields.fornecedorDoc?.value || "";
  el("entryForm").reset();
  formFields.fornecedor.value = keepFornecedor;
  if (formFields.fornecedorDoc) formFields.fornecedorDoc.value = keepFornecedorDoc;
  saveState();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildFortesLine(entry) {
  return fortesFields(entry).join(";");
}

function simplifiedSupplierName(name) {
  const n = String(name || "").trim();
  if (normalize(n).startsWith("REEMBOLSO")) return "REEMBOLSO";
  return n.slice(0, 40);
}

function fortesFields(entry) {
  const vencimento = fields.vencimento.value || state.meta.vencimento || "2026-06-10";
  const valorReal = Number(entry.valor || 0);
  return [
    "",
    formatDate(vencimento),
    money(valorReal),
    entry.fornecedorCnpjCpf,
    simplifiedSupplierName(entry.fornecedorNome),
    formatDate(entry.data),
    "",
    entry.centroCodigo,
    expenseCodeForTxt(entry.despesaCodigo),
    entry.documento || entry.descricao,
    "00001",
    monthYear(entry.data),
    "",
    formatDate(entry.data),
    "",
    "",
    "",
    "04",
    money(valorReal),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];
}

function validateLine(line) {
  const parts = line.split(";");
  return parts.length === 32 && /^\d{2}\/\d{2}\/\d{4}$/.test(parts[1]) && /^\d+,\d{2}$/.test(parts[2]);
}

function render() {
  readMetaFromFields();
  const body = el("entriesBody");
  body.innerHTML = "";
  let total = 0;

  for (const entry of state.entries) {
    total += Number(entry.valor || 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(entry.data)}</td>
      <td>${escapeHtml(entry.descricao)}</td>
      <td>${escapeHtml(entry.despesaNome)}</td>
      <td class="code">${escapeHtml(expenseCodeForTxt(entry.despesaCodigo))}</td>
      <td>${escapeHtml(entry.centroNome)}</td>
      <td class="code">${escapeHtml(entry.centroCodigo)}</td>
      <td>${escapeHtml(simplifiedSupplierName(entry.fornecedorNome))}</td>
      <td>${escapeHtml(entry.documento)}</td>
      <td class="amount">${brl(entry.valor)}</td>
      <td><button class="remove" type="button" data-id="${entry.id}">Remover</button></td>
    `;
    body.appendChild(tr);
  }

  el("summary").innerHTML = `
    <div class="summary-card">
      <span>Total de lançamentos</span>
      <strong>${state.entries.length}</strong>
    </div>
    <div class="summary-card highlight">
      <span>Valor total</span>
      <strong>${brl(total)}</strong>
    </div>
  `;
}

function removeEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  saveState();
}

function downloadTxt() {
  render();
  const text = el("txtPreview").value.trim();
  if (!text) {
    alert("Nao ha lancamentos para baixar.");
    return;
  }
  const invalid = text.split("\n").filter((line) => !validateLine(line));
  if (invalid.length) {
    alert("Existe linha com formato invalido. Revise antes de baixar.");
    return;
  }
  const blob = new Blob([text + "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "importacao_fortes_reembolso.txt";
  a.click();
  URL.revokeObjectURL(url);
}

function exportWorkFile() {
  saveState();
  if (!state.entries.length) {
    alert("Nao ha lancamentos para enviar.");
    return;
  }
  const colaborador = normalize(fields.nome.value || "colaborador").replace(/\s+/g, "_").toLowerCase();
  const blob = buildCollaboratorPdf();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prestacao_contas_${colaborador}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSubmissionFile() {
  saveState();
  if (!state.entries.length) {
    alert("Nao ha lancamentos para enviar.");
    return;
  }
  const payload = {
    tipo: "prestacao-contas-fortes",
    versao: 2,
    geradoEm: new Date().toISOString(),
    colaborador: {
      nome: fields.nome.value,
      cargo: fields.cargo.value,
      cpf: fields.cpf.value,
      banco: fields.banco.value,
      conta: fields.conta.value,
      pix: fields.pix.value,
      periodoDe: entryPeriod().from,
      periodoAte: entryPeriod().to,
    },
    entries: state.entries,
  };
  const colaborador = normalize(fields.nome.value || "colaborador").replace(/\s+/g, "_").toLowerCase();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `envio_financeiro_${colaborador}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCollaboratorPdf() {
  const pageW = 842;
  const pageH = 595;
  const margin = 28;
  const rowH = 18;
  const rowsPerPage = 20;
  const total = state.entries.reduce((sum, entry) => sum + Number(entry.valor || 0), 0);
  const pages = [];
  const chunks = [];

  for (let i = 0; i < state.entries.length; i += rowsPerPage) {
    chunks.push(state.entries.slice(i, i + rowsPerPage));
  }

  for (let pageIndex = 0; pageIndex < chunks.length; pageIndex++) {
    const rows = chunks[pageIndex];
    const commands = [];
    const add = (cmd) => commands.push(cmd);
    const text = (x, y, value, size = 8, bold = false) => {
      add(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
    };
    const rect = (x, y, w, h, fill = null, stroke = true) => {
      if (fill) add(`q ${fill} rg ${x} ${y} ${w} ${h} re f Q`);
      if (stroke) add(`q 0.75 0.78 0.82 RG ${x} ${y} ${w} ${h} re S Q`);
    };
    const line = (x1, y1, x2, y2) => add(`q 0.75 0.78 0.82 RG ${x1} ${y1} m ${x2} ${y2} l S Q`);

    text(margin, pageH - 34, "RELATORIO DE PRESTACAO DE CONTAS E REEMBOLSO", 15, true);
    text(pageW - 190, pageH - 34, `Pagina ${pageIndex + 1} de ${chunks.length}`, 8);
    add(`q 0.956 0.482 0.125 rg ${margin} ${pageH - 48} ${pageW - margin * 2} 4 re f Q`);

    const infoY = pageH - 76;
    text(margin, infoY, "Dados do colaborador", 10, true);
    text(margin, infoY - 18, `Nome: ${fields.nome.value || ""}`, 8);
    text(margin, infoY - 34, `Cargo: ${fields.cargo.value || ""}`, 8);
    text(margin, infoY - 50, `CPF: ${fields.cpf.value || ""}`, 8);
    text(330, infoY - 18, `Banco: ${fields.banco.value || ""}`, 8);
    text(330, infoY - 34, `Conta: ${fields.conta.value || ""}`, 8);
    text(330, infoY - 50, `PIX: ${fields.pix.value || ""}`, 8);
    const periodo = entryPeriod();
    text(610, infoY - 18, `Periodo: ${formatDate(periodo.from)} a ${formatDate(periodo.to)}`, 8);
    text(610, infoY - 34, `Total: ${brl(total)}`, 10, true);

    const tableTop = pageH - 155;
    const cols = [
      { title: "Data", x: margin, w: 58 },
      { title: "Descricao", x: margin + 58, w: 162 },
      { title: "Despesa", x: margin + 220, w: 108 },
      { title: "Centro de Custo", x: margin + 328, w: 150 },
      { title: "Fornecedor", x: margin + 478, w: 232 },
      { title: "Valor", x: margin + 710, w: 76 },
    ];

    rect(margin, tableTop, pageW - margin * 2, 22, "0.956 0.482 0.125", false);
    for (const col of cols) text(col.x + 4, tableTop + 8, col.title, 8, true);
    line(margin, tableTop, pageW - margin, tableTop);

    let y = tableTop - rowH;
    for (const entry of rows) {
      rect(margin, y, pageW - margin * 2, rowH, null, true);
      text(cols[0].x + 4, y + 6, formatDate(entry.data), 7);
      text(cols[1].x + 4, y + 6, fit(entry.descricao, 36), 7);
      text(cols[2].x + 4, y + 6, fit(entry.despesaNome, 23), 7);
      text(cols[3].x + 4, y + 6, fit(entry.centroNome, 30), 7);
      text(cols[4].x + 4, y + 6, fit(simplifiedSupplierName(entry.fornecedorNome), 48), 7);
      text(cols[5].x + 6, y + 6, brl(entry.valor), 7, true);
      y -= rowH;
    }

    text(margin, 28, `Gerado em ${new Date().toLocaleString("pt-BR")}`, 7);
    pages.push(commands.join("\n"));
  }

  return pdfFromPages(pages, pageW, pageH);
}

function fit(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function pdfText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfFromPages(pageStreams, width, height) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];

  for (const stream of pageStreams) {
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function toggleFinance(show) {
  setTab(show ? "financeiro" : "colaborador");
}

async function importWorkFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.tipo !== "prestacao-contas-fortes" || !Array.isArray(payload.entries)) {
      throw new Error("Arquivo invalido.");
    }
    const colaborador = payload.colaborador || {};
    for (const [key, input] of Object.entries(fields)) {
      if (key in colaborador) input.value = colaborador[key] || "";
    }
    state.entries = payload.entries;
    saveState();
    setTab("financeiro");
    alert("Arquivo importado. Agora informe a data de pagamento/vencimento e gere o TXT ou CSV.");
  } catch (error) {
    alert(`Nao foi possivel importar: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function setTab(name) {
  const financeiro = name === "financeiro";
  el("tabColaborador").classList.toggle("active", !financeiro);
  el("tabFinanceiro").classList.toggle("active", financeiro);
  el("viewColaborador").classList.toggle("active", !financeiro);
  el("viewFinanceiro").classList.toggle("active", financeiro);
}

function togglePreview() {
  const body = el("previewBody");
  const arrow = el("previewArrow");
  const show = body.hidden;
  body.hidden = !show;
  arrow.textContent = show ? "↑" : "↓";
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function buildCsv() {
  const headers = [
    "Codigo de Barras",
    "Data de Vencimento",
    "Valor do Vencimento",
    "CNPJ/CPF do Fornecedor",
    "Nome do Fornecedor",
    "Data de Entrada",
    "Titulo",
    "Centro de Resultados",
    "Despesa",
    "Documento",
    "Historico Padrao",
    "Mes/Ano",
    "Observacao",
    "Emissao NF",
    "Exporta para a Contabilidade",
    "Agente Pagador",
    "Forma de Lancamento",
    "Tipo de Servico",
    "Valor Bruto",
    "ISS Base",
    "ISS Valor",
    "IRRF Base",
    "IRRF CNPJ Valor",
    "IRRF CPF Valor",
    "ICMS Base",
    "ICMS Valor",
    "PIS Base",
    "PIS Valor",
    "INSS Base",
    "INSS CNPJ Valor",
    "INSS CPF Valor",
    "CPF/CNPJ Favorecido",
  ];
  const rows = state.entries.map((entry) => fortesFields(entry));
  return [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n");
}

function downloadCsv() {
  render();
  if (!state.entries.length) {
    alert("Nao ha lancamentos para baixar.");
    return;
  }
  const blob = new Blob([buildCsv() + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "importacao_fortes_reembolso.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function copyTxt() {
  render();
  await navigator.clipboard.writeText(el("txtPreview").value);
  alert("TXT copiado.");
}

function clearEntries() {
  if (!state.entries.length) return;
  if (!confirm("Limpar todos os lancamentos?")) return;
  state.entries = [];
  saveState();
}

function bindEvents() {
  el("entryForm").addEventListener("submit", addEntry);
  el("downloadPdfBtn").addEventListener("click", exportWorkFile);
  el("downloadSubmissionBtn").addEventListener("click", exportSubmissionFile);
  el("clearBtn").addEventListener("click", clearEntries);
  el("entriesBody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (button) removeEntry(button.dataset.id);
  });
  for (const input of Object.values(fields)) input.addEventListener("change", saveState);
  for (const input of [formFields.despesa, formFields.centro, formFields.fornecedor, formFields.fornecedorDoc]) {
    if (input) input.addEventListener("input", updateQuickInfo);
  }
}

try {
  fillDatalists();
  setupFilters();
  loadState();
  writeStateToFields();
  bindEvents();
  updateQuickInfo();
  render();
} catch (error) {
  console.error(error);
  const box = el("quickInfo");
  if (box) {
    box.textContent = `Erro ao carregar o sistema: ${error.message}. Recarregue com Ctrl + F5.`;
    box.classList.add("warning");
  }
}
