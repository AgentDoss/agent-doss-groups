// Fond féerique : orbes lumineux + poussière d'étoiles. Positions déterministes (pas de Math.random).
const N = 28;
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return (x - Math.floor(x)).toFixed(2);
};

export default function MagicBackground() {
  return (
    <div className="magic" aria-hidden="true">
      <span className="orb o1" />
      <span className="orb o2" />
      <span className="orb o3" />
      {Array.from({ length: N }, (_, i) => (
        <i
          key={i}
          className="star"
          style={{
            left: `${Number(rnd(i, 1)) * 100}%`,
            top: `${Number(rnd(i, 2)) * 100}%`,
            "--d": `${3 + Number(rnd(i, 3)) * 5}s`,
            "--s": `${2 + Number(rnd(i, 4)) * 4}px`,
            "--dl": `${Number(rnd(i, 5)) * -6}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
