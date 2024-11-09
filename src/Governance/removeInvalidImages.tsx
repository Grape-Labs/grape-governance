import { visit } from 'unist-util-visit';

export default function removeInvalidImages() {
    return (tree) => {
        visit(tree, 'image', (node, index, parent) => {
            if (!node.url) {
                // Remove node if it doesn't have a 'url' (src in Markdown)
                parent.children.splice(index, 1);
            }
        });
    };
}
