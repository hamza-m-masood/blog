import type { PhrasingContent, Root } from 'mdast'
import { toString as mdastToString } from 'mdast-util-to-string'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { h as _h, type Properties } from 'hastscript'
import type { Paragraph as P } from 'mdast'

/** From Astro Starlight: Function that generates an mdast HTML tree ready for conversion to HTML by rehype. */
function h(el: string, attrs: Properties = {}, children: any[] = []): P {
  const { properties, tagName } = _h(el, attrs)
  return {
    children,
    data: { hName: tagName, hProperties: properties },
    type: 'paragraph',
  }
}

const DEFAULT_LABEL = 'Click to reveal the answer'

/** Turns `:::spoiler[Custom label]` containers into a native `<details>` element. */
const remarkSpoiler: Plugin<[], Root> = () => (tree) => {
  visit(tree, (node, index, parent) => {
    if (!parent || index === undefined || node.type !== 'containerDirective') return
    if (node.name !== 'spoiler') return

    let label = DEFAULT_LABEL
    let labelNode: PhrasingContent[] = [{ type: 'text', value: label }]

    // Check if there's a custom label
    const firstChild = node.children[0]
    if (
      firstChild?.type === 'paragraph' &&
      firstChild.data &&
      'directiveLabel' in firstChild.data &&
      firstChild.children.length > 0
    ) {
      labelNode = firstChild.children
      label = mdastToString(firstChild.children)
      // The first paragraph contains a custom label, we can safely remove it.
      node.children.splice(0, 1)
    }

    parent.children[index] = h('details', { class: 'spoiler' }, [
      h('summary', { class: 'spoiler-summary', 'aria-label': label }, [...labelNode]),
      h('div', { class: 'spoiler-content' }, node.children),
    ])
  })
}

export default remarkSpoiler
