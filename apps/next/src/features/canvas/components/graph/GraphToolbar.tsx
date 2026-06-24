import { Card, Select, ListBox, ToggleButton, ToggleButtonGroup, TextField, InputGroup, Button, ButtonGroup, Chip, Tooltip } from '@heroui/react'
import { Maximize, Minus, Plus, RotateCcw, Search } from 'lucide-react'
import { useCanvasStrings } from '../../i18n'
import type { GraphToolbarProps, GraphLayout } from '../../types/graph'
import type { GraphNodeKind } from '@/core/appGraph'

// Graph toolbar — Layout picker · kind filter · search · counts · stale chip · fit + zoom. All HeroUI
// chrome (design §3 component map). No custom CSS; structural Tailwind for layout only.

const FILTER_KINDS: GraphNodeKind[] = ['app', 'chat', 'mounted-app']
const LAYOUTS: GraphLayout[] = ['hierarchical', 'force', 'radial']
const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2

export function GraphToolbar({
  layout,
  onLayoutChange,
  visibleKinds,
  onToggleKind,
  query,
  onQueryChange,
  onFit,
  zoom,
  onZoomChange,
  nodeCount,
  edgeCount,
  stale = false,
  disabled = false,
}: GraphToolbarProps) {
  const t = useCanvasStrings()

  return (
    <Card variant="secondary">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <Select
          aria-label={t.graph.toolbar.layout}
          variant="secondary"
          className="w-[160px]"
          selectedKey={layout}
          onSelectionChange={(key) => key != null && onLayoutChange(String(key) as GraphLayout)}
          isDisabled={disabled}
          data-testid="graph-layout"
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {LAYOUTS.map((l) => (
                <ListBox.Item key={l} id={l} textValue={t.graph.layouts[l]}>
                  {t.graph.layouts[l]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <ToggleButtonGroup
          selectionMode="multiple"
          size="sm"
          selectedKeys={visibleKinds}
          onSelectionChange={(keys) => onToggleKind(Array.from(keys) as GraphNodeKind[])}
          isDisabled={disabled}
          aria-label={t.graph.toolbar.filter}
        >
          {FILTER_KINDS.map((k) => (
            <ToggleButton key={k} id={k}>
              {t.graph.kinds[k]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <TextField
          className="w-48"
          value={query}
          onChange={onQueryChange}
          aria-label={t.graph.toolbar.search}
          isDisabled={disabled}
        >
          <InputGroup>
            <InputGroup.Prefix>
              <Search className="size-4 text-muted" aria-hidden />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder={t.graph.toolbar.searchPlaceholder} data-testid="graph-search" />
          </InputGroup>
        </TextField>

        <div className="ml-auto flex items-center gap-2">
          <Chip size="sm" variant="soft">{t.graph.counts.nodes(nodeCount)}</Chip>
          <Chip size="sm" variant="soft">{t.graph.counts.edges(edgeCount)}</Chip>
          {stale ? <Chip size="sm" variant="soft" color="warning">{t.graph.stale}</Chip> : null}

          <Tooltip>
            <Button variant="tertiary" size="sm" isIconOnly onPress={onFit} isDisabled={disabled} aria-label={t.graph.toolbar.fit}>
              <Maximize className="size-4" />
            </Button>
            <Tooltip.Content>{t.graph.toolbar.fit}</Tooltip.Content>
          </Tooltip>

          <ButtonGroup>
            <Button
              variant="tertiary"
              size="sm"
              isIconOnly
              onPress={() => onZoomChange(Math.max(ZOOM_MIN, Math.round((zoom - ZOOM_STEP) * 10) / 10))}
              isDisabled={disabled || zoom <= ZOOM_MIN}
              aria-label={t.graph.toolbar.zoomOut}
            >
              <Minus className="size-4" />
            </Button>
            <Button variant="tertiary" size="sm" isIconOnly onPress={() => onZoomChange(1)} isDisabled={disabled} aria-label={t.graph.toolbar.zoomReset}>
              <RotateCcw className="size-4" />
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              isIconOnly
              onPress={() => onZoomChange(Math.min(ZOOM_MAX, Math.round((zoom + ZOOM_STEP) * 10) / 10))}
              isDisabled={disabled || zoom >= ZOOM_MAX}
              aria-label={t.graph.toolbar.zoomIn}
            >
              <Plus className="size-4" />
            </Button>
          </ButtonGroup>
        </div>
      </div>
    </Card>
  )
}
