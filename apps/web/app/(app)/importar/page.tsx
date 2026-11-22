import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { ImportForm } from './import-form';
import { getMe } from '@/lib/api-queries';
import { getToken } from '@/lib/session';
import { accessTokenSub } from '@/lib/token-expiry';
import { classifySharedFile } from '@/lib/share-target';
import { peekShare } from '@/lib/share-stash';
import { PDF_GUIDES } from '@/lib/pdf-guide';
import { PdfImport } from './pdf-import';
import { SharedStatement } from './shared-statement';

export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; voltar?: string; arquivo?: string }>;
}) {
  const [{ conta, voltar, arquivo }, me, { locale, t }, token] = await Promise.all([
    searchParams,
    getMe().catch(() => null),
    getI18n(),
    getToken(),
  ]);
  // Arquivo que veio do "Compartilhar" do Android (guardado 10 min, só pra essa pessoa).
  const key = token ? accessTokenSub(token) : null;
  const shared = key && arquivo ? peekShare(key, arquivo) : null;
  const sharedKind = shared ? classifySharedFile(shared) : null;
  const p = t.pages.importar;
  const contas = (me?.connections ?? [])
    .filter((c) => c.isImport)
    .map((c) => c.institution ?? '')
    .filter(Boolean);
  const backHref = resolveBackHref(voltar, '/mais');

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-center gap-3">
        <Mascot pose="conectando" size={72} alt={p.mascotAlt} />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">{p.title}</h1>
          <p className="text-[15px] text-tinta-suave">{p.subtitle}</p>
        </div>
      </div>
      {arquivo && !shared && (
        <p role="status" className="rounded-2xl bg-amarelo-claro px-3.5 py-3 text-[14px] leading-5">
          O arquivo compartilhado venceu (ficamos com ele só por 10 minutos). Compartilha de novo ou escolhe o arquivo
          abaixo.
        </p>
      )}
      {shared && sharedKind === 'statement' && <SharedStatement shareId={arquivo!} fileName={shared.name} />}
      <section
        aria-labelledby="pdf-titulo"
        className="flex flex-col gap-3 rounded-[22px] border border-linha bg-cartao p-4"
      >
        <div className="flex flex-col gap-0.5">
          <h2 id="pdf-titulo" className="font-display text-[20px] leading-6 font-extrabold">
            PDF da fatura ou do extrato
          </h2>
          <p className="text-[13px] leading-[19px] text-tinta-suave">
            Mais fácil que OFX: baixe o PDF no app do banco, escolha aqui e confira as linhas antes de importar.
          </p>
        </div>
        <PdfImport shareId={shared && sharedKind === 'pdf' ? arquivo : undefined} />
        <div className="flex flex-col text-[13px] leading-[19px]">
          <h3 className="text-[14px] font-bold">Como baixar o PDF</h3>
          {PDF_GUIDES.map((g) => (
            <details key={g.id} className="border-b border-linha last-of-type:border-0">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold">
                {g.name} <span className="font-normal text-tinta-suave">· {g.what}</span>
                <span aria-hidden className="text-tinta-suave">
                  +
                </span>
              </summary>
              <ol className="flex flex-col gap-1.5 pb-2.5 pl-0.5">
                {g.steps.map((step, i) => (
                  <li key={step} className="flex gap-2.5 text-tinta-suave">
                    <span
                      aria-hidden
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tinta text-[11px] font-bold text-papel"
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>
      <ImportForm conta={conta} contas={contas} locale={locale} />
      <div className="flex flex-col rounded-2xl bg-papel-2 px-3.5 py-3 text-[13px] leading-[19px]">
        <h2 className="text-[14px] font-bold">{p.whereToDownload}</h2>
        {p.banks.map((b) => (
          <details key={b.name} className="border-b border-linha last-of-type:border-0">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold">
              {b.name}
              <span aria-hidden className="text-tinta-suave">
                +
              </span>
            </summary>
            <p className="pb-1 text-tinta-suave">{b.steps}</p>
          </details>
        ))}
        <p className="pt-2 text-tinta-suave">{p.footerNote}</p>
      </div>
    </PageFrame>
  );
}
