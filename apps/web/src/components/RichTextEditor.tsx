"use client";

import { useRef, useState } from "react";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { uploadSessionImage } from "../lib/bookings";
import { hydrateAttachmentImages } from "../lib/hydrateAttachmentImages";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function ToolbarButton({
  label,
  pressed,
  onClick,
  disabled,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded px-2 text-sm font-medium ${
        pressed ? "bg-primary/20 text-primary" : "text-foreground hover:bg-muted"
      } disabled:cursor-not-allowed disabled:text-muted-foreground`}
    >
      {label}
    </button>
  );
}

function Toolbar({
  editor,
  onInsertImage,
  imageUploading,
}: {
  editor: Editor | null;
  onInsertImage: () => void;
  imageUploading: boolean;
}) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap gap-1 border-b border-border bg-muted p-1">
      <ToolbarButton
        label="Tebal"
        pressed={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Miring"
        pressed={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Garis bawah"
        pressed={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        label="Daftar"
        pressed={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Nomor"
        pressed={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Judul"
        pressed={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label={imageUploading ? "Mengunggah..." : "Sisipkan Gambar"}
        pressed={false}
        disabled={imageUploading}
        onClick={onInsertImage}
      />
    </div>
  );
}

export function RichTextEditor({
  id,
  bookingId,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  bookingId: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Image.configure({ HTMLAttributes: { class: "session-notes-image" } }),
    ],
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.isEmpty ? "" : instance.getHTML());
      void hydrateAttachmentImages(instance.view.dom as HTMLElement, bookingId);
    },
    onCreate: ({ editor: instance }) => {
      void hydrateAttachmentImages(instance.view.dom as HTMLElement, bookingId);
    },
    editorProps: {
      attributes: {
        id,
        class: "session-notes-editor min-h-64 px-3 py-3 text-sm focus:outline-none",
        "aria-label": "Catatan sesi",
      },
    },
  });

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      window.alert("Format gambar tidak didukung. Gunakan JPEG, PNG, WEBP, atau GIF.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      window.alert("Ukuran gambar maksimal 5MB.");
      return;
    }
    setImageUploading(true);
    try {
      const { id: attachmentId } = await uploadSessionImage(bookingId, file);
      editor.chain().focus().setImage({ src: `attachment:${attachmentId}` }).run();
      void hydrateAttachmentImages(editor.view.dom as HTMLElement, bookingId);
    } catch {
      window.alert("Gagal mengunggah gambar. Silakan coba lagi.");
    } finally {
      setImageUploading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-input">
      <Toolbar
        editor={editor}
        imageUploading={imageUploading}
        onInsertImage={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelected}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
