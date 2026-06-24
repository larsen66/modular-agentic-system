import { Drawer, Button, Chip, Separator, Breadcrumbs, ScrollShadow } from '@heroui/react'
import { useCanvasStrings } from '../../i18n'
import type { GraphNodeDetailProps } from '../../types/graph'

// Node-detail drawer (right placement) — opens on selection. Shows kind / path / fan-in/out + the
// "Open file" hand-off (gated by codeAuthority via `canOpenFile`). Controlled-open from the screen:
// open === (node != null). HeroUI Drawer + Chip + Separator + Breadcrumbs; no custom CSS.

export function GraphNodeDetail({ node, inDegree, outDegree, canOpenFile, onOpenFile, onClose }: GraphNodeDetailProps) {
  const t = useCanvasStrings()
  const open = node != null

  return (
    <Drawer>
      <Drawer.Backdrop isOpen={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <Drawer.Content placement="right">
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>{node?.label ?? ''}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <ScrollShadow orientation="vertical">
                {node ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" variant="secondary">{t.graph.detail.kind}: {t.graph.kinds[node.kind]}</Chip>
                      <Chip size="sm" variant="soft">{t.graph.detail.inDegree(inDegree)}</Chip>
                      <Chip size="sm" variant="soft">{t.graph.detail.outDegree(outDegree)}</Chip>
                    </div>
                    <Separator />
                    {node.path ? (
                      <Breadcrumbs aria-label={t.graph.detail.path}>
                        {node.path.split('/').filter(Boolean).map((seg, i) => (
                          <Breadcrumbs.Item key={`${seg}-${i}`}>{seg}</Breadcrumbs.Item>
                        ))}
                      </Breadcrumbs>
                    ) : (
                      <p className="text-sm text-muted">{t.graph.detail.noPath}</p>
                    )}
                  </div>
                ) : null}
              </ScrollShadow>
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">{t.graph.detail.close}</Button>
              <Button
                variant="primary"
                size="sm"
                isDisabled={!canOpenFile || !node?.path}
                onPress={() => node && onOpenFile(node)}
              >
                {t.graph.detail.openFile}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}
