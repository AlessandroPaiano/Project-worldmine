import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { WikiLink } from './extensions/WikiLink';

interface TiptapProps {
    content: string;
    onChange: (html: string) => void;
}

export default function TiptapEditor({ content, onChange }: TiptapProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({ openOnClick: false }),
            WikiLink,
        ],
        content,
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-sm max-w-none w-full h-full focus:outline-none placeholder-[#4a4d5e]',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex gap-2 mb-2 pb-2 border-b border-[#2d3036] shrink-0">
                <button
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={`px-2 py-1 text-xs rounded hover:bg-[#23252a] ${editor?.isActive('bold') ? 'bg-[#23252a] text-[#74b1be]' : 'text-[#8a8f98]'}`}
                >
                    Bold
                </button>
                <button
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={`px-2 py-1 text-xs rounded hover:bg-[#23252a] ${editor?.isActive('italic') ? 'bg-[#23252a] text-[#74b1be]' : 'text-[#8a8f98]'}`}
                >
                    Italic
                </button>
                <button
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`px-2 py-1 text-xs rounded hover:bg-[#23252a] ${editor?.isActive('heading', { level: 2 }) ? 'bg-[#23252a] text-[#74b1be]' : 'text-[#8a8f98]'}`}
                >
                    H2
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <EditorContent editor={editor} className="h-full" />
            </div>
        </div>
    );
}
