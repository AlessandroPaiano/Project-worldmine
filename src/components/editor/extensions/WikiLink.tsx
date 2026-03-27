import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useStore } from '../../../store';
import type { Entity } from '../../../lib/api';

// React component to render the Wiki-link node
const WikiLinkView = (props: NodeViewProps) => {
    const { node } = props;
    const { label } = node.attrs;
    const entities = useStore(state => state.entities);

    // Check if the exact entity name exists (case-insensitive)
    const exists = entities.some((e: Entity) => e.name.toLowerCase() === label.toLowerCase());

    const handleClick = () => {
        const entity = entities.find((e: Entity) => e.name.toLowerCase() === label.toLowerCase());
        if (entity) {
            // Trigger a navigation event or open the entity.
            // For now, we update hash route manually since we don't have access to useNavigate here easily
            const typeFolder = entity.type + 's'; // simple pluralize
            window.location.hash = `#/entity/${typeFolder}`;

            // Allow time for route change, then click the entity in the sidebar
            setTimeout(() => {
                const els = document.querySelectorAll('.cursor-pointer');
                for (const el of Array.from(els)) {
                    if (el.textContent === entity.name) {
                        (el as HTMLElement).click();
                        break;
                    }
                }
            }, 50); // slight delay for React Router to render
        }
    };

    return (
        <NodeViewWrapper as="span" className="inline-block">
            <span
                onClick={handleClick}
                className={`font-semibold px-1 rounded cursor-pointer transition ${exists ? 'text-[#74b1be] bg-[#181a1f] hover:bg-[#23252a] border border-[#2d3036]' : 'text-[#8a8f98] bg-transparent border border-dashed border-[#4a4d5e]'}`}
                title={exists ? `Jump to ${label}` : 'Entity does not exist yet'}
            >
                [[{label}]]
            </span>
        </NodeViewWrapper>
    );
};

// Tiptap Extension definition
export const WikiLink = Node.create({
    name: 'wikiLink',
    group: 'inline',
    inline: true,
    selectable: false,
    atom: true,

    addAttributes() {
        return {
            label: {
                default: '',
                parseHTML: element => element.getAttribute('data-label'),
                renderHTML: attributes => {
                    return {
                        'data-label': attributes.label,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="wikiLink"]',
                getAttrs: (dom) => {
                    const label = (dom as HTMLElement).getAttribute('data-label');
                    if (!label) return false;
                    return { label };
                }
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'wikiLink' }), `[[${HTMLAttributes.label}]]`];
    },

    addNodeView() {
        return ReactNodeViewRenderer(WikiLinkView);
    },

    addInputRules() {
        return [
            {
                find: /\[\[([^\]]+)\]\]$/,
                handler: ({ state, range, match }) => {
                    const label = match[1];
                    const { tr } = state;

                    if (label) {
                        const node = this.type.create({ label });
                        tr.replaceWith(range.from, range.to, node);
                    }
                },
                getAttributes: () => ({}),
                undoable: false, // Fix TS error
            },
        ];
    },
});
