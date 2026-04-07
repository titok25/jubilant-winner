import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Pencil, RefreshCw, Trash2 } from "lucide-react";

type LinkItem = {
  id: number;
  slug: string;
  targetUrl: string;
  redirectType: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
  lastClickedAt: string | null;
  shortUrl: string;
};

type EditingState = {
  id: number;
  slug: string;
  targetUrl: string;
  redirectType: number;
} | null;

const emptyForm = {
  targetUrl: "",
  slug: "",
  redirectType: 301,
};

export default function Home() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<EditingState>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const totalClicks = useMemo(
    () => links.reduce((sum, item) => sum + Number(item.clicks || 0), 0),
    [links],
  );

  async function loadLinks(options?: { silent?: boolean }) {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/links");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível carregar os links.");
      }

      setLinks(data.links || []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Falha ao carregar os links.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLinks();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível criar o link.");
      }

      setForm(emptyForm);
      setMessage({ type: "success", text: "Link criado com sucesso." });
      await loadLinks({ silent: true });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível criar o link.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm("Deseja realmente excluir este link? Esta ação não poderá ser desfeita.");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível excluir o link.");
      }

      setMessage({ type: "success", text: "Link removido com sucesso." });
      await loadLinks({ silent: true });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível excluir o link.",
      });
    }
  }

  async function handleCopy(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setMessage({ type: "success", text: "Link curto copiado para a área de transferência." });
    } catch {
      setMessage({ type: "error", text: "Não foi possível copiar o link curto." });
    }
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    try {
      const response = await fetch(`/api/links/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: editing.targetUrl,
          redirectType: editing.redirectType,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível atualizar o link.");
      }

      setEditing(null);
      setMessage({ type: "success", text: "Destino atualizado com sucesso sem alterar o slug." });
      await loadLinks({ silent: true });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível atualizar o link.",
      });
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleString("pt-BR");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.14),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-2xl shadow-slate-200/60 backdrop-blur">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.5fr_0.9fr] lg:px-10">
            <div>
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700">
                Elegant and perfect style
              </span>
              <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Encurtador de links profissional para campanhas, operações e tráfego de alta escala.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Crie slugs personalizados, troque o destino sem quebrar campanhas, monitore cliques ilimitados e escolha entre redirecionamento 301 ou 302 com resposta limpa.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <article className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Links ativos</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{links.length}</p>
              </article>
              <article className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total de cliques</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{totalClicks}</p>
              </article>
              <article className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-xl shadow-indigo-300/40">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-100">Redirect padrão</p>
                <p className="mt-3 text-3xl font-semibold">301</p>
              </article>
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-8 xl:grid-cols-[380px_1fr]">
          <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/60 backdrop-blur">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Criar novo link</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Defina um slug memorável, informe a URL de destino e selecione o tipo de redirecionamento mais adequado para sua campanha.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleCreate}>
              <div>
                <label htmlFor="targetUrl" className="mb-2 block text-sm font-medium text-slate-700">
                  URL de destino
                </label>
                <input
                  id="targetUrl"
                  type="url"
                  required
                  value={form.targetUrl}
                  onChange={event => setForm(current => ({ ...current, targetUrl: event.target.value }))}
                  placeholder="https://seudominio.com/pagina-de-vendas"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label htmlFor="slug" className="mb-2 block text-sm font-medium text-slate-700">
                  Slug personalizado
                </label>
                <input
                  id="slug"
                  type="text"
                  minLength={3}
                  maxLength={63}
                  required
                  value={form.slug}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      slug: event.target.value.toLowerCase().replace(/\s+/g, "-"),
                    }))
                  }
                  placeholder="meu-produto-01"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                <p className="mt-2 text-xs text-slate-500">Use letras minúsculas, números e hífens.</p>
              </div>

              <div>
                <label htmlFor="redirectType" className="mb-2 block text-sm font-medium text-slate-700">
                  Tipo de redirecionamento
                </label>
                <select
                  id="redirectType"
                  value={form.redirectType}
                  onChange={event => setForm(current => ({ ...current, redirectType: Number(event.target.value) }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                >
                  <option value={301}>301 · Permanente</option>
                  <option value={302}>302 · Temporário</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Criando..." : "Criar link curto"}
              </button>
            </form>

            {message ? (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {message.text}
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/60 backdrop-blur">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">Dashboard de links</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Visualize, copie, edite destinos e remova links antigos em um único painel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadLinks({ silent: true })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slug</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Destino</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">HTTP</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cliques</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Atualizado</th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                          Carregando links...
                        </td>
                      </tr>
                    ) : links.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                          Nenhum link cadastrado ainda. Crie o primeiro link ao lado para iniciar sua operação.
                        </td>
                      </tr>
                    ) : (
                      links.map(link => (
                        <tr key={link.id} className="align-top">
                          <td className="px-5 py-4">
                            <div className="space-y-2">
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                /{link.slug}
                              </span>
                              <a
                                href={link.shortUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-sm font-medium text-indigo-700 hover:text-indigo-900"
                              >
                                {link.shortUrl}
                              </a>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm leading-6 text-slate-600">
                            <div className="max-w-md break-all">{link.targetUrl}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                link.redirectType === 302
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {link.redirectType}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm font-medium text-slate-700">{link.clicks}</td>
                          <td className="px-5 py-4 text-sm text-slate-500">{formatDate(link.updatedAt)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopy(link.shortUrl)}
                                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditing({
                                    id: link.id,
                                    slug: link.slug,
                                    targetUrl: link.targetUrl,
                                    redirectType: link.redirectType,
                                  })
                                }
                                className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <a
                                href={link.shortUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDelete(link.id)}
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-white/80 bg-white p-6 shadow-2xl shadow-slate-300/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">Editar destino do link</h3>
                <p className="mt-2 text-sm text-slate-500">O slug permanece intacto. Apenas a URL de destino será alterada.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleEditSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Slug</label>
                <input
                  type="text"
                  disabled
                  value={editing.slug}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Nova URL de destino</label>
                <input
                  type="url"
                  required
                  value={editing.targetUrl}
                  onChange={event => setEditing(current => (current ? { ...current, targetUrl: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Tipo de redirecionamento</label>
                <select
                  value={editing.redirectType}
                  onChange={event => setEditing(current => (current ? { ...current, redirectType: Number(event.target.value) } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                >
                  <option value={301}>301 · Permanente</option>
                  <option value={302}>302 · Temporário</option>
                </select>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
