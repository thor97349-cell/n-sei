interface BarraProgressoProps {
  valor: number; // 0-100
  corClasse: string; // classes tailwind para o preenchimento
  alturaClasse?: string;
}

export default function BarraProgresso({
  valor,
  corClasse,
  alturaClasse = "h-2",
}: BarraProgressoProps) {
  const percentual = Math.max(0, Math.min(100, valor));
  return (
    <div className={`w-full ${alturaClasse} rounded-full bg-black/40 overflow-hidden`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${corClasse}`}
        style={{ width: `${percentual}%` }}
      />
    </div>
  );
}
