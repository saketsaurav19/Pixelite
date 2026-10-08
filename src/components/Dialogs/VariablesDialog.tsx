import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { VariableType, DocumentVariable, DataSet } from '../../store/types';
import './Dialogs.css';

export type VariablesTab = 'variables' | 'datasets' | 'export';

const VAR_META: Record<VariableType, { label: string; icon: React.ReactNode; accent: string }> = {
  visibility: {
    label: 'Visibility',
    icon: <LucideIcons.Eye size={15} />,
    accent: '#5b9cff',
  },
  text_content: {
    label: 'Text Content',
    icon: <LucideIcons.Type size={15} />,
    accent: '#3ecf8e',
  },
  pixel_content: {
    label: 'Pixel Content',
    icon: <LucideIcons.Image size={15} />,
    accent: '#f5a623',
  },
};

const VAR_TYPES: VariableType[] = ['visibility', 'text_content', 'pixel_content'];

interface VarSelectOption {
  value: string;
  label: string;
}

interface VarSelectProps {
  options: VarSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  narrow?: boolean;
  icon?: React.ReactNode;
}

const VarSelect: React.FC<VarSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  narrow = false,
  icon,
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const display = selected ? selected.label : placeholder;

  return (
    <div className="var-select-wrap">
      {icon}
      <button
        type="button"
        className={`var-select${narrow ? ' var-select-narrow' : ''}`}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      >
        <span className="var-select-value">{display}</span>
      </button>
      <LucideIcons.ChevronDown size={14} className="var-select-chevron" />
      {open && (
        <div className="var-dropdown" onMouseDown={(e) => e.preventDefault()}>
          {options.length === 0 ? (
            <div className="var-dropdown-empty">No options</div>
          ) : (
            options.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`var-dropdown-item${o.value === value ? ' active' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                <span className="var-dropdown-label">{o.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const parseCSV = (raw: string): { headers: string[]; rows: Record<string, string>[] } => {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
  return { headers, rows };
};

export const VariablesDialog: React.FC = () => {
  const {
    isVariablesDialogOpen,
    setIsVariablesDialogOpen,
    layers,
    activeLayerId,
    variablesData,
    addVariable,
    removeVariable,
    addDataSet,
    updateDataSet,
    removeDataSet,
    addAlert,
    documentSize,
  } = useStore();

  const [activeTab, setActiveTab] = useState<VariablesTab>('variables');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [varInput, setVarInput] = useState<Record<VariableType, string>>({
    visibility: '',
    text_content: '',
    pixel_content: '',
  });
  const [fileNameVariable, setFileNameVariable] = useState('');
  const [exportFormat, setExportFormat] = useState<'JPG' | 'PNG' | 'PDF'>('PNG');
  const [isExporting, setIsExporting] = useState(false);

  if (!isVariablesDialogOpen) return null;

  const { variables, dataSets } = variablesData;
  const effectiveLayerId = selectedLayerId ?? activeLayerId ?? layers[0]?.id ?? null;

  const variableNameTaken = (name: string, exceptId?: string) =>
    variables.some((v: DocumentVariable) => v.name.toLowerCase() === name.trim().toLowerCase() && v.id !== exceptId);

  const handleAddVariable = (type: VariableType, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !effectiveLayerId || variableNameTaken(trimmed)) return;
    addVariable({ id: `var-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, layerId: effectiveLayerId, type, name: trimmed });
    setVarInput((prev) => ({ ...prev, [type]: '' }));
  };

  const renderVariableSection = (type: VariableType) => {
    const meta = VAR_META[type];
    const name = varInput[type];
    const setName = (v: string) => setVarInput((prev) => ({ ...prev, [type]: v }));
    const sectionVars = variables.filter((v: DocumentVariable) => v.type === type);
    return (
      <div className="var-section">
        <div className="var-section-head">
          <span className="var-section-icon" style={{ color: meta.accent }}>{meta.icon}</span>
          <span className="var-section-title">{meta.label}</span>
          {sectionVars.length > 0 && <span className="var-count-badge">{sectionVars.length}</span>}
        </div>

        {sectionVars.length > 0 ? (
          <ul className="var-chip-list">
            {sectionVars.map((v: DocumentVariable) => {
              const layer = layers.find((l) => l.id === v.layerId);
              return (
                <li key={v.id} className="var-chip var-chip-wide" style={{ borderColor: `${meta.accent}55` }}>
                  <span className="var-chip-dot" style={{ background: meta.accent }} />
                  <span className="var-chip-name">{v.name}</span>
                  <span className="var-chip-layer" title={layer?.name}>{layer?.name ?? '—'}</span>
                  <button type="button" className="var-chip-remove" onClick={() => removeVariable(v.id)} title="Remove">
                    <LucideIcons.X size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="var-add-row">
          <div className="var-add-pill">
            <LucideIcons.PlusCircle size={15} className="var-add-pill-icon" style={{ color: meta.accent }} />
            <input
              className="var-input"
              value={name}
              placeholder={`New ${meta.label.toLowerCase()} variable`}
              disabled={!effectiveLayerId}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handleAddVariable(type, name); setName(''); }
              }}
            />
            <button
              type="button"
              className="var-add-btn"
              disabled={!effectiveLayerId || !name.trim() || variableNameTaken(name)}
              onClick={() => { handleAddVariable(type, name); setName(''); }}
              title="Add variable"
              style={{ background: meta.accent, borderColor: meta.accent }}
            >
              <LucideIcons.Plus size={16} />
            </button>
          </div>
        </div>
        {!effectiveLayerId && <div className="var-hint">Select a layer to define a variable.</div>}
      </div>
    );
  };

  // ---- Export helpers -------------------------------------------------------

  const mimeFor = (fmt: 'JPG' | 'PNG' | 'PDF') =>
    fmt === 'JPG' ? 'image/jpeg' : fmt === 'PNG' ? 'image/png' : 'image/png';

  const triggerDownload = (href: string, name: string) => {
    const link = document.createElement('a');
    link.download = name;
    link.href = href;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Draw a shape layer directly from its data model. Shape layers are rendered
  // as HTML <svg> overlays at runtime (their per-layer <canvas> is opacity:0),
  // so we must reconstruct them on the export canvas from `shapeData`.
  const drawShape = (
    ctx: CanvasRenderingContext2D,
    layer: any,
    px: number,
    py: number,
    layerW: number,
    layerH: number,
  ) => {
    const sd = layer.shapeData;
    if (!sd) return;
    const { type, w, h, points, fill, stroke, strokeWidth: sw, smooth, closed, cornerRadius, svgPath } = sd;
    const scaleX = layerW / (w || layerW);
    const scaleY = layerH / (h || layerH);
    const strokeColor = stroke || 'transparent';
    const fillColor = fill || 'transparent';
    const strokeW = sw || 0;

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scaleX, scaleY);

    const doFill = fillColor && fillColor !== 'transparent';
    const doStroke = strokeW > 0 && strokeColor && strokeColor !== 'transparent';

    if (type === 'rect' || !type) {
      const rw = Math.max(0, (w || 100) - strokeW);
      const rh = Math.max(0, (h || 100) - strokeW);
      const rad = cornerRadius || 0;
      ctx.beginPath();
      if (rad > 0 && (ctx as any).roundRect) {
        (ctx as any).roundRect(strokeW / 2, strokeW / 2, rw, rh, rad);
      } else {
        ctx.rect(strokeW / 2, strokeW / 2, rw, rh);
      }
      if (doFill) { ctx.fillStyle = fillColor; ctx.fill(); }
      if (doStroke) { ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeW; ctx.stroke(); }
    } else if (type === 'ellipse') {
      const rx = Math.max(0, (w || 100) / 2 - strokeW / 2);
      const ry = Math.max(0, (h || 100) / 2 - strokeW / 2);
      ctx.beginPath();
      ctx.ellipse((w || 100) / 2, (h || 100) / 2, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
      if (doFill) { ctx.fillStyle = fillColor; ctx.fill(); }
      if (doStroke) { ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeW; ctx.stroke(); }
    } else if (type === 'path') {
      if (svgPath) {
        try {
          const p = new Path2D(svgPath);
          if (doFill) { ctx.fillStyle = fillColor; ctx.fill(p); }
          if (doStroke) { ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeW; ctx.stroke(p); }
        } catch { /* ignore malformed path */ }
      } else if (points && points.length > 0) {
        ctx.beginPath();
        if (smooth && points.length >= 3) {
          const len = points.length;
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 0; i < (closed ? len : len - 1); i++) {
            const p0 = points[(i - 1 + len) % len];
            const p1 = points[i % len];
            const p2 = points[(i + 1) % len];
            const p3 = points[(i + 2) % len];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }
        } else {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        }
        if (closed || smooth) ctx.closePath();
        if (doFill) { ctx.fillStyle = fillColor; ctx.fill(); }
        if (doStroke) { ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeW; ctx.stroke(); }
      }
    }
    ctx.restore();
  };

  // Composite the current document to an offscreen canvas, applying a single
  // data-set row's variable substitutions (visibility + text content).
  const renderRow = async (row: Record<string, string>): Promise<HTMLCanvasElement> => {
    const w = documentSize?.w || 800;
    const h = documentSize?.h || 600;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Draw bottom-of-stack first so top layers (layers[0]) paint last,
    // matching the editor's own getMergedImageData layer order.
    const ordered = [...layers].reverse();
    for (let li = 0; li < ordered.length; li++) {
      const layer = ordered[li];
      let visible = layer.visible !== false;
      let textContent = layer.textContent;

      variables
        .filter((v: DocumentVariable) => v.layerId === layer.id)
        .forEach((v: DocumentVariable) => {
          const value = row[v.name];
          if (value === undefined) return;
          if (v.type === 'visibility') {
            visible = !/^(false|0|no|off)$/i.test(value.trim());
          } else if (v.type === 'text_content') {
            textContent = value;
          }
          // 'pixel_content' rows are expected to reference an external image
          // asset (Phase 2) — not substituted here.
        });

      if (!visible) continue;

      const px = (layer.position?.x || 0);
      const py = (layer.position?.y || 0);
      const layerW = layer.width || layer.shapeData?.w || (layer.type === 'shape' ? 100 : Math.max(10, w));
      const layerH = layer.height || layer.shapeData?.h || (layer.type === 'shape' ? 100 : Math.max(10, h));
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      if (layer.type === 'shape') {
        // Shapes are vector overlays (opacity:0 canvas) — draw from shapeData.
        drawShape(ctx, layer, px, py, layerW, layerH);
      } else if (textContent !== undefined && textContent !== '') {
        // Text layers are HTML overlays (opacity:0 canvas) — draw directly.
        drawTextFallback(ctx, layer, textContent, px, py, layerW);
      } else if (layer.type === 'table' && layer.dataUrl) {
        const img = await loadImage(layer.dataUrl);
        if (img) ctx.drawImage(img, px, py);
      } else {
        // Raster layers (image / paint) — draw the per-layer canvas if present.
        const el = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement | null;
        if (el && el.width > 0 && el.height > 0) {
          ctx.drawImage(el, px, py);
        } else if (layer.dataUrl) {
          const img = await loadImage(layer.dataUrl);
          if (img) ctx.drawImage(img, px, py);
        }
      }
      ctx.restore();
    }

    return canvas;
  };

  // Direct canvas text rendering (fallback when no live DOM overlay is found).
  const drawTextFallback = (
    ctx: CanvasRenderingContext2D,
    layer: any,
    textContent: string,
    px: number,
    py: number,
    layerW: number,
  ) => {
    const fontSize = layer.fontSize || 32;
    const weight = layer.fontWeight || 'normal';
    const style = layer.fontStyle || 'normal';
    const cleanFamily = (layer.fontFamily || 'sans-serif').replace(/^[A-Z]{6}\+/, '');
    const fontStr = `${style} ${weight} ${fontSize}px "${cleanFamily}", "Noto Sans", sans-serif`;
    const color = layer.color || '#ffffff';
    const lines = textContent.split('\n');
    const lineH = fontSize * 1.2;
    const isVertical = !!layer.isVertical;

    ctx.font = fontStr;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';

    const align = layer.textAlign || 'left';
    if (isVertical) {
      const charStep = fontSize;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        for (let ci = 0; ci < line.length; ci++) {
          ctx.textAlign = 'left';
          ctx.fillText(line[ci], px + ci * charStep, py + li * lineH + ci * charStep);
        }
      }
    } else {
      ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
      const anchorX = align === 'center' ? px + layerW / 2 : align === 'right' ? px + layerW : px;
      lines.forEach((line, i) => ctx.fillText(line, anchorX, py + i * lineH));
    }
    if (layer.strokeWidth && layer.strokeWidth > 0 && layer.strokeColor) {
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = layer.strokeWidth;
      ctx.lineJoin = 'round';
      lines.forEach((line, i) => ctx.strokeText(line, align === 'center' ? px + layerW / 2 : align === 'right' ? px + layerW : px, py + i * lineH));
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const safeName = (raw: string, fallback: string) =>
    (raw || '').trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_') || fallback;

  const handleExport = async () => {
    if (dataSets.length === 0) return;
    setIsExporting(true);
    try {
      const base = (documentSize && (useStore.getState().activeDocumentName || 'pixelite')) || 'pixelite';
      const ext = exportFormat === 'JPG' ? 'jpg' : exportFormat === 'PNG' ? 'png' : 'pdf';

      for (let i = 0; i < dataSets.length; i++) {
        const row = dataSets[i].values;
        const canvas = await renderRow(row);
        const fileNameValue = fileNameVariable ? safeName(row[fileNameVariable], `item_${i + 1}`) : `item_${i + 1}`;
        const name = `${base}_${fileNameValue}.${ext}`;

        if (exportFormat === 'PDF') {
          // Embed the page as a JPEG (DCTDecode) — directly embeddable in a PDF.
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          const jpegBytes = atob(jpegDataUrl.split(',')[1]);
          let jpegBin = '';
          for (let b = 0; b < jpegBytes.length; b++) jpegBin += String.fromCharCode(jpegBytes.charCodeAt(b));

          const orientation = canvas.width >= canvas.height ? 'L' : 'P';
          const pageW = orientation === 'L' ? 841.89 : 595.28;
          const pageH = orientation === 'L' ? 595.28 : 841.89;
          const scale = Math.min(pageW / canvas.width, pageH / canvas.height) * 0.95;
          const drawW = canvas.width * scale;
          const drawH = canvas.height * scale;
          const x = (pageW - drawW) / 2;
          const y = (pageH - drawH) / 2;
          const content = `q ${drawW} 0 0 ${drawH} ${x} ${y} cm /Im0 Do Q`;

          const obj = (n: number, s: string) => `${n} 0 obj\n${s}\nendobj\n`;
          const objects: string[] = [];
          objects.push(obj(1, `<</Type/Catalog/Pages 2 0 R>>`));
          objects.push(obj(2, `<</Type/Pages/Kids[3 0 R]/Count 1>>`));
          objects.push(obj(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pageW} ${pageH}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`));
          objects.push(obj(4, `<</Type/XObject/Subtype/Image/Width ${canvas.width}/Height ${canvas.height}/ColorSpace/DeviceRGB/Filter/DCTDecode/BitsPerComponent 8/Length ${jpegBytes.length}>>stream\n${jpegBin}\nendstream`));
          objects.push(obj(5, `<</Length ${content.length}>>stream\n${content}\nendstream`));

          let pdf = '%PDF-1.4\n';
          const offsets: number[] = [];
          objects.forEach((o, idx) => {
            offsets[idx] = pdf.length;
            pdf += o;
          });
          const xrefPos = pdf.length;
          pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
          offsets.forEach((off) => { pdf += `${String(off).padStart(10, '0')} 00000 n \n`; });
          pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;

          triggerDownload('data:application/pdf;base64,' + btoa(pdf), name);
        } else {
          const dataUrl = canvas.toDataURL(mimeFor(exportFormat), exportFormat === 'JPG' ? 0.9 : undefined);
          triggerDownload(dataUrl, name);
        }
        await new Promise((r) => setTimeout(r, 120)); // let each download register
      }
      addAlert({ type: 'success', message: `Exported ${dataSets.length} item(s) as ${exportFormat}.` });
    } catch (err) {
      console.error('Variables export failed', err);
      addAlert({ type: 'error', message: 'Export failed. See console for details.' });
    } finally {
      setIsExporting(false);
    }
  };

  // ---- Tab renderers --------------------------------------------------------

  const renderVariablesTab = () => (
    <div className="dialog-body var-body">
      <div className="var-field">
        <label className="var-label">Layer</label>
        <VarSelect
          icon={<LucideIcons.Layers size={15} className="var-select-icon" />}
          options={layers.map((layer) => ({ value: layer.id, label: layer.name }))}
          value={effectiveLayerId ?? ''}
          onChange={(v) => setSelectedLayerId(v)}
          placeholder="Select a layer"
          disabled={layers.length === 0}
        />
      </div>

      {VAR_TYPES.map((t) => <React.Fragment key={t}>{renderVariableSection(t)}</React.Fragment>)}

      {variables.length === 0 && (
        <div className="var-empty var-empty-inline">
          <LucideIcons.Variable size={26} />
          <span>No variables defined yet</span>
          <small>Pick a layer and add variables — names become dataset columns.</small>
        </div>
      )}
    </div>
  );

  const applyCSV = () => {
    const { headers, rows } = parseCSV(csvText);
    if (headers.length === 0) return;
    rows.forEach((row, i) => {
      addDataSet({ id: `ds-${Date.now()}-${i}-${Math.floor(Math.random() * 1e4)}`, values: row });
    });
    setCsvText('');
  };

  const renderDataSetsTab = () => {
    const columns = variables.map((v: DocumentVariable) => v.name);
    return (
      <div className="dialog-body var-body var-datasets">
        <div className="var-csv-box">
          <label className="var-label">Paste CSV (first row = column headers)</label>
          <textarea
            className="var-csv-input"
            value={csvText}
            placeholder={"CName,About,Flag-image,IsSA\nUSA,The US,usa.png,true"}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <button type="button" className="var-export-btn" onClick={applyCSV} disabled={!csvText.trim()}>
            <LucideIcons.FileText size={15} /> Import rows from CSV
          </button>
          {variables.length > 0 && (
            <div className="var-hint">Expected columns: {columns.map((c: string) => <code key={c}>{c}</code>).reduce((prev: (string | React.ReactElement)[] | null, cur: string | React.ReactElement) => prev === null ? [cur] : [...prev, ', ', cur], null as any)}</div>
          )}
        </div>

        <div className="var-dataset-dropzone">
          {dataSets.length === 0 ? (
            <div className="var-empty">
              <LucideIcons.Table2 size={28} />
              <span>No data sets yet</span>
              <small>Paste CSV above, or add rows manually below.</small>
            </div>
          ) : (
            <div className="var-table-scroll">
              <table className="var-table">
                <thead>
                  <tr>
                    <th className="var-col-idx">#</th>
                    {columns.map((c: string) => <th key={c}>{c}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {dataSets.map((ds: DataSet, idx: number) => (
                    <tr key={ds.id}>
                      <td className="var-col-idx">{idx + 1}</td>
                      {columns.map((c: string) => (
                        <td key={c}>
                          <input
                            className="var-cell-input"
                            value={ds.values[c] ?? ''}
                            onChange={(e) => updateDataSet(ds.id, { ...ds.values, [c]: e.target.value })}
                          />
                        </td>
                      ))}
                      <td>
                        <button type="button" className="var-chip-remove" onClick={() => removeDataSet(ds.id)} title="Remove row">
                          <LucideIcons.Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <button
          type="button"
          className="var-add-row-btn"
          disabled={columns.length === 0}
          onClick={() => addDataSet({ id: `ds-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, values: {} })}
        >
          <LucideIcons.Plus size={15} /> Add empty row
        </button>
        {columns.length === 0 && <div className="var-hint">Define at least one variable first — its name becomes a column.</div>}
      </div>
    );
  };

  const renderExportTab = () => (
    <div className="dialog-body var-body var-export">
      <div className="var-field">
        <label className="var-label">Variable for file names</label>
        <VarSelect
          narrow
          options={[{ value: '', label: '(none)' }, ...variables.map((v: DocumentVariable) => ({ value: v.name, label: v.name }))]}
          value={fileNameVariable}
          onChange={(v) => setFileNameVariable(v)}
          placeholder="(none)"
        />
      </div>

      <div className="var-field">
        <label className="var-label">Format</label>
        <div className="var-segmented">
          {(['JPG', 'PNG', 'PDF'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              className={`var-segment${exportFormat === fmt ? ' active' : ''}`}
              onClick={() => setExportFormat(fmt)}
            >{fmt}</button>
          ))}
        </div>
      </div>

      <div className="var-field">
        <div className="var-label-row">
          <label className="var-label">Quality</label>
          <span className="var-quality-val">70%</span>
        </div>
        <input type="range" min="0" max="100" defaultValue={70} className="var-range" />
      </div>

      <div className="var-field">
        <label className="var-checkbox">
          <input type="checkbox" defaultChecked />
          <span>Attach metadata</span>
        </label>
      </div>

      <button type="button" className="var-export-btn" disabled={dataSets.length === 0 || isExporting} onClick={handleExport}>
        <LucideIcons.Download size={15} />
        {isExporting ? 'Exporting…' : `Export ${dataSets.length > 0 ? `${dataSets.length} ` : ''}item${dataSets.length === 1 ? '' : 's'}`}
      </button>
      {dataSets.length === 0 && <div className="var-hint">Add data sets to enable export. Each row is exported as one file.</div>}
      {exportFormat === 'PDF' && <div className="var-hint">PDF exports one image per page per data-set row.</div>}
    </div>
  );

  const tabs: { id: VariablesTab; label: string }[] = [
    { id: 'variables', label: 'Variables' },
    { id: 'datasets', label: 'Data Sets' },
    { id: 'export', label: 'Export as' },
  ];

  return (
    <div className="dialog-overlay variables-overlay" onClick={() => setIsVariablesDialogOpen(false)}>
      <div className="dialog-content variables-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header variables-header">
          <div className="variables-title-group">
            <LucideIcons.Variable size={18} />
            <h3>Variables</h3>
          </div>
          <button className="dialog-close" onClick={() => setIsVariablesDialogOpen(false)} title="Close">
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="variables-tabs">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`vtab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'variables' && renderVariablesTab()}
        {activeTab === 'datasets' && renderDataSetsTab()}
        {activeTab === 'export' && renderExportTab()}

        <div className="dialog-footer variables-footer">
          <button className="dialog-btn primary" onClick={() => setIsVariablesDialogOpen(false)}>OK</button>
        </div>
      </div>
    </div>
  );
};
