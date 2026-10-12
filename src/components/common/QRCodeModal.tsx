import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { TableItem, Restaurant } from '../../types/database';
import { X, Printer, ExternalLink, Download } from 'lucide-react';

interface QRCodeModalProps {
  table: TableItem;
  restaurant: Restaurant;
  onClose: () => void;
  onOpenClientView: (restaurantId: string, tableId: string) => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  table,
  restaurant,
  onClose,
  onOpenClientView
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  
  // URL to table menu
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tableUrl = `${origin}?table=${table.id}&restaurant=${restaurant.id}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        tableUrl,
        {
          width: 260,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff'
          }
        },
        (error) => {
          if (error) console.error(error);
          else if (canvasRef.current) {
            setDataUrl(canvasRef.current.toDataURL());
          }
        }
      );
    }
  }, [tableUrl]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_Table_${table.table_number}_${restaurant.slug}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">QR Code — Table {table.table_number}</h3>
            <p className="text-xs text-slate-300">{restaurant.name} • Zone: {table.zone}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center flex flex-col items-center">
          <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl mb-4 shadow-inner">
            <canvas ref={canvasRef} className="rounded-lg shadow-xs" />
          </div>

          <div className="text-xs text-slate-500 font-mono bg-slate-100 py-1.5 px-3 rounded-lg max-w-full truncate mb-4">
            {tableUrl}
          </div>

          <p className="text-xs text-slate-600 mb-6">
            Scannez ce QR Code avec un smartphone pour ouvrir directement le menu et la session de la Table {table.table_number}.
          </p>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 w-full">
            <button
              onClick={() => onOpenClientView(restaurant.id, table.id)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition shadow-xs"
            >
              <ExternalLink className="w-4 h-4" />
              Ouvrir Menu
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
            >
              <Download className="w-4 h-4" />
              Télécharger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
