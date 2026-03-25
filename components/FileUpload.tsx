"use client";

import { useRef, useState } from "react";

import { useAdmin } from "@/components/AdminProvider";
import { uploadKnowledgeFile } from "@/lib/api";
import { KnowledgeDocument } from "@/lib/types";

type FileUploadProps = {
  agentId: string;
  onUploaded: (document: KnowledgeDocument) => Promise<void> | void;
};

export default function FileUpload({ agentId, onUploaded }: FileUploadProps) {
  const { addToast } = useAdmin();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadStage, setUploadStage] = useState<"uploading" | "processing">("uploading");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async () => {
    if (!selectedFile || loading) return;
    setLoading(true);
    setUploadStage("uploading");
    setUploadPercent(0);
    setUploadedBytes(0);
    setTotalBytes(selectedFile.size);
    try {
      const document = await uploadKnowledgeFile(agentId, selectedFile, (progress) => {
        setUploadPercent(progress.percent);
        setUploadedBytes(progress.loaded);
        setTotalBytes(progress.total);
        if (progress.percent >= 100) {
          setUploadStage("processing");
        }
      });
      await onUploaded(document);
      addToast({ title: "File uploaded", description: `${document.file_name} is indexed and ready.` });
      setSelectedFile(null);
    } catch (error) {
      addToast({ title: "Upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    } finally {
      setLoading(false);
      setUploadPercent(0);
      setUploadedBytes(0);
      setTotalBytes(0);
      setUploadStage("uploading");
    }
  };

  return (
    <>
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
          className="hidden"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center transition hover:border-slate-300 hover:bg-white"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
            <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden="true">
              <path d="M10 13V5m0 0-3 3m3-3 3 3M4 13.5v1A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700">
            {selectedFile ? selectedFile.name : "Click to select a file"}
          </p>
          <p className="mt-1 text-xs text-slate-400">Supports PDF, DOCX, PPTX, and TXT. Make sure the file contains selectable text.</p>
        </button>

        <div className="flex items-center justify-between gap-3">
          {selectedFile ? (
            <p className="text-xs text-slate-500 truncate">{selectedFile.name} ready to upload</p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!selectedFile || loading}
            className="h-8 shrink-0 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Uploading..." : "Upload file"}
          </button>
        </div>
      </div>

      {loading && selectedFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                <Spinner />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">File Upload In Progress</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {uploadStage === "processing" ? "Extracting text and indexing file" : "Uploading file"}
                </p>
                <p className="mt-1 truncate text-sm text-slate-500">{selectedFile.name}</p>
                <div className="mt-5 h-2.5 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full bg-slate-950 transition-all duration-300"
                    style={{ width: `${Math.max(uploadPercent, uploadStage === "processing" ? 100 : 0)}%` }}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">
                    {uploadStage === "processing" ? "Processing on server" : "Sending file to server"}
                  </span>
                  <span className="font-medium text-slate-700">
                    {uploadStage === "processing"
                      ? `${formatBytes(totalBytes || selectedFile.size)} uploaded`
                      : `${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes || selectedFile.size)}`}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-700">
                  {uploadStage === "processing" ? "Upload complete. Please wait while we index the document." : `${uploadPercent}% uploaded`}
                </p>
                <p className="mt-5 text-xs text-slate-400">Please keep this page open while the file upload finishes.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 animate-spin text-slate-600" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
