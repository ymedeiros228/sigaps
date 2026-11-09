import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { Ubs } from '../../services/api';
import { useMapStore } from '../../store';
import { REFERENCE_CATEGORIES, type ReferenceCategory } from '../../utils/pdfMapSettings';

const STYLE = Object.fromEntries(REFERENCE_CATEGORIES.map((c) => [c.id, c])) as Record<
  ReferenceCategory,
  (typeof REFERENCE_CATEGORIES)[number]
>;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/**
 * Marcador com o nome embaixo, tudo num ícone só: o html2canvas fotografa ícones
 * de forma confiável (tooltips às vezes saem fora do lugar).
 */
function labeledIcon(opts: { name: string; glyph: string; color: string; scale: number; size: number; strong?: boolean }) {
  const { name, glyph, color, scale, size, strong } = opts;
  const dot = Math.round(size * scale);
  const font = Math.round((strong ? 12 : 10.5) * scale);
  return L.divIcon({
    className: 'pdf-ref-marker',
    html: `<div style="position:relative;width:${dot}px;height:${dot}px;">
      <div style="width:${dot}px;height:${dot}px;background:${color};border:2px solid #fff;border-radius:50%;
        box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;
        color:#fff;font:800 ${Math.round(dot * 0.55)}px/1 Arial,sans-serif;">${glyph}</div>
      <div style="position:absolute;top:${dot + 2}px;left:50%;transform:translateX(-50%);white-space:nowrap;
        font:${strong ? 800 : 700} ${font}px/1.15 Arial,sans-serif;color:${strong ? color : '#37474f'};
        text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 0 3px #fff;">${escapeHtml(name)}</div>
    </div>`,
    iconSize: [dot, dot],
    iconAnchor: [dot / 2, dot / 2],
  });
}

interface PdfReferencePointsLayerProps {
  ubsList: Ubs[];
}

/** Só existe durante a foto do PDF: UBS com nome e pontos de referência do OpenStreetMap. */
export function PdfReferencePointsLayer({ ubsList }: PdfReferencePointsLayerProps) {
  const view = useMapStore((s) => s.pdfCapture);
  if (!view) return null;
  const scale = view.labelScale;

  return (
    <>
      {view.referencePoints.map((p) => {
        const st = STYLE[p.category];
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={labeledIcon({ name: p.name, glyph: st.glyph, color: st.color, scale, size: 16 })}
            zIndexOffset={300}
            interactive={false}
          />
        );
      })}
      {ubsList.map((u) => (
        <Marker
          key={u.id}
          position={[u.latitude, u.longitude]}
          icon={labeledIcon({ name: u.name, glyph: '+', color: '#1565C0', scale, size: 22, strong: true })}
          zIndexOffset={600}
          interactive={false}
        />
      ))}
    </>
  );
}
