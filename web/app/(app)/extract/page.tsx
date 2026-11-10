"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Folder } from "lucide-react";
import ContractTable from "@/components/ContractTable";
import DocumentTree from "@/components/DocumentTree";
import JsonBlock, { downloadJson, formatJson } from "@/components/JsonBlock";
import MoreMenu from "@/components/MoreMenu";
import { categoryLabel, documentHref } from "@/constants/documents";
import { useCopy } from "@/hooks/useCopy";
import { useDocuments } from "@/hooks/useDocuments";
import { useExtract } from "@/hooks/useExtract";
import { useFolders } from "@/hooks/useFolders";
import type { DocumentSummary } from "@/types/api";
import styles from "./page.module.css";

type View = "table" | "json";

// useSearchParams needs a Suspense boundary (cacheComponents).
export default function ExtractPage() {
  return (
    <Suspense>
      <ExtractScreen />
    </Suspense>
  );
}

/** ?contract=ID picks the contract (default: the first one); ?view=json shows the JSON view. */
function ExtractScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const view: View = params.get("view") === "json" ? "json" : "table";
  const contractParam = params.get("contract");

  const documents = useDocuments();
  const contracts = useMemo(
    () => (documents.data ?? []).filter((d) => d.category === "contracts").sort((a, b) => a.id.localeCompare(b.id)),
    [documents.data],
  );
  const contract = contractParam ? contracts.find((d) => d.id === contractParam) : contracts[0];

  const extraction = useExtract(contract?.id ?? null);
  const details = extraction.data?.details ?? null;
  const folders = useFolders(["contracts"]);
  const { copied, copy } = useCopy();

  const href = (contractId: string | undefined, nextView: View) => {
    const next = new URLSearchParams();
    if (contractId) next.set("contract", contractId);
    if (nextView === "json") next.set("view", "json");
    return next.size ? `/extract?${next}` : "/extract";
  };
  const contractHref = (d: DocumentSummary) => href(d.id, view);
  const showView = (nextView: View) => router.replace(href(contractParam ?? undefined, nextView), { scroll: false });

  const filename = `${contract?.id ?? "contract"}.json`;

  return (
    <div className={styles.page}>
      <section className={styles.centre} aria-label="Extract">
        <header className={`glass ${styles.header}`}>
          <h1 className={styles.title}>Extract</h1>
          <div className={styles.switch} role="group" aria-label="View">
            {(["table", "json"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={styles.switchOption}
                aria-pressed={view === v}
                onClick={() => showView(v)}
              >
                {v === "table" ? "Table" : "JSON"}
              </button>
            ))}
          </div>
          {view === "json" && (
            <button
              type="button"
              className={`btn-secondary ${styles.copy}`}
              disabled={!details}
              onClick={() => details && copy(formatJson(details))}
            >
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? "Copied" : "Copy JSON"}
            </button>
          )}
        </header>

        <div className={`glass ${styles.card}`}>
          {contract ? (
            <>
              <div className={styles.heading}>
                <Folder size={16} fill="currentColor" strokeWidth={0} aria-hidden className={styles.folderIcon} />
                <div className={styles.headingText}>
                  <h2 className={styles.contractTitle}>{contract.title}</h2>
                  <p className={styles.contractMeta}>
                    {categoryLabel(contract.category)} · {contract.id}
                  </p>
                </div>
              </div>

              {details ? (
                view === "json" ? (
                  <JsonBlock value={details} filename={filename} />
                ) : (
                  <ContractTable details={details} />
                )
              ) : extraction.error ? (
                <div className={styles.statusBox}>
                  <p className={styles.status}>Couldn&rsquo;t read this contract right now.</p>
                  <button type="button" className="btn-secondary" onClick={extraction.retry}>
                    Try again
                  </button>
                </div>
              ) : (
                <p className={`${styles.status} ${styles.statusBox}`} aria-live="polite">
                  Reading the contract…
                </p>
              )}
            </>
          ) : (
            <p className={styles.status}>
              {documents.error
                ? "Couldn't load the contracts."
                : documents.data
                  ? contracts.length
                    ? "Couldn't find this contract. Pick one from the list."
                    : "No contracts have been loaded yet."
                  : "Loading contracts…"}
            </p>
          )}
        </div>
      </section>

      <aside className={styles.side} aria-label="Sample contracts">
        <div className={`glass ${styles.sideTitle}`}>
          <h2>Sample contracts</h2>
          <MoreMenu
            label="Contract options"
            items={[
              ...(contract ? [{ label: "Read this contract", href: documentHref(contract.id) }] : []),
              {
                label: `Download ${filename}`,
                onSelect: () => details && downloadJson(details, filename),
                disabled: !details,
              },
            ]}
          />
        </div>
        <div className={`glass ${styles.treeCard}`}>
          {documents.data ? (
            <DocumentTree
              documents={contracts}
              open={folders.open}
              onToggle={folders.toggle}
              activeId={contract?.id}
              hrefFor={contractHref}
            />
          ) : (
            <p className={styles.status}>{documents.error ? "Couldn't load the contracts." : "Loading contracts…"}</p>
          )}
        </div>
        <p className={`glass ${styles.note}`}>Pick a contract and its key details fill in automatically.</p>
      </aside>
    </div>
  );
}
