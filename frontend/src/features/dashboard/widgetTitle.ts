import type { Widget } from '@/api/contract';

export function widgetTitle(widget: Widget) {
  return widget.kind === 'chart' ? widget.definition.title : widget.title;
}
