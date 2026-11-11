import { modules, MODULE_COLORS } from '@/lib/lessons';
import { Mascote } from '@/components/mascote';
import { Trilha } from './trilha';

export default function AprenderPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[34px] leading-tight font-extrabold">Sua trilha</h1>
        <Mascote pose="professor" size={88} alt="Tostão professor" />
      </div>
      <Trilha modules={modules} colors={MODULE_COLORS} />
      <div className="mt-2 flex items-center gap-2 rounded-[20px] bg-azul p-3">
        <Mascote pose="urubu-fugindo" size={88} alt="Urubu do Pix fugindo" />
        <div>
          <p className="font-display text-[17px] font-extrabold">No fim da trilha, os vilões fogem</p>
          <p className="text-[13px]">O módulo 9 te ensina a desmascarar o Urubu do Pix e o Tigrinho de vez.</p>
        </div>
      </div>
    </div>
  );
}
