"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

/**
 * A guide image that opens larger in a modal dialog (native <dialog>: focus is trapped, Esc and a
 * click outside close it). The large version only loads once opened.
 */
export function ZoomableImage({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        aria-label={alt ? `Enlarge image: ${alt}` : "Enlarge image"}
        className="block w-full cursor-zoom-in rounded-[12px]"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(min-width: 720px) 680px, 100vw"
          className="h-auto w-full rounded-[12px] border border-line"
        />
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-label={alt || "Image"}
        className="m-auto max-h-[92vh] max-w-[94vw] overflow-visible bg-transparent p-0 backdrop:bg-black/80"
      >
        {open && (
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes="94vw"
            className="h-auto max-h-[92vh] w-auto max-w-[94vw] rounded-[12px]"
          />
        )}
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label="Close"
          className="absolute -top-12 right-0 flex size-10 items-center justify-center rounded-full bg-bg text-text"
        >
          <X className="size-5 [stroke-width:1.75]" aria-hidden />
        </button>
      </dialog>
    </>
  );
}
