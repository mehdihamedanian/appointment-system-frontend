"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { X } from "lucide-react";
import { cx } from "@/lib/utilities/cx";

export type UploadItem = {
  id: string;
  file: File;
  previewUrl?: string;
  status: "idle" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
};

export function FileUpload({
  accept,
  maxSizeBytes = 5 * 1024 * 1024,
  maxFiles = 3,
  multiple = true,
  files,
  onChange,
  label = "بارگذاری پرونده",
}: {
  accept?: string;
  maxSizeBytes?: number;
  maxFiles?: number;
  multiple?: boolean;
  files: UploadItem[];
  onChange: (files: UploadItem[]) => void;
  label?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");

  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    urlsRef.current = files
      .map((item) => item.previewUrl)
      .filter((url): url is string => Boolean(url));
  }, [files]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const next = [...files];
    for (const file of incoming) {
      if (next.length >= maxFiles) {
        setMessage(`حداکثر ${maxFiles} پرونده مجاز است.`);
        break;
      }
        if (file.size > maxSizeBytes) {
          setMessage(`حجم ${file.name} بیش از حد مجاز است.`);
          continue;
        }
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
          status: "idle",
        });
      }
      if (next.length !== files.length) {
        onChange(multiple ? next : next.slice(-1));
      }
  }

  function remove(id: string) {
    const target = files.find((item) => item.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((item) => item.id !== id));
  }

  return (
    <div>
      <div
        className={cx("ds-upload", dragging && "is-dragging")}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files) addFiles(event.dataTransfer.files);
        }}
      >
        <p id={`${inputId}-label`}>{label}</p>
        <p id={`${inputId}-help`} className="ds-help">
          کشیدن و رها کردن یا انتخاب از دستگاه. اعتبارسنجی فقط برای تجربه کاربری است.
        </p>
        <Button
          type="button"
          variant="secondary"
          aria-describedby={`${inputId}-label ${inputId}-help`}
          onClick={() => inputRef.current?.click()}
        >
          انتخاب پرونده
        </Button>
        <input
          ref={inputRef}
          id={inputId}
          className="visually-hidden"
          tabIndex={-1}
          aria-label={label}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      <p className={message ? "ds-error" : "visually-hidden"} role="status">
        {message}
      </p>
      <ul className="ds-upload__list">
        {files.map((item) => (
          <li key={item.id} className="ds-inline">
            {item.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.previewUrl} alt="" width={40} height={40} />
            ) : null}
            <span>{item.file.name}</span>
            {item.error ? <span className="ds-error">{item.error}</span> : null}
            <IconButton label={`حذف ${item.file.name}`} onClick={() => remove(item.id)}>
              <X size={14} />
            </IconButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
