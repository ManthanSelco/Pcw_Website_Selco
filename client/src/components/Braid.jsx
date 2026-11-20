// Striped thread (orange / yellow / pink), the PCW "common thread" decoration
export default function Braid({ className = '', d = 'M0 120 C 220 10, 380 -20, 560 60 S 820 330, 1000 300 S 1180 210, 1240 160' }) {
  const colors = ['#ff5c39', '#ffbf3f', '#ffb1bb'];
  return (
    <svg className={`pcw-braid ${className}`} viewBox="0 0 1240 360" fill="none" aria-hidden="true" preserveAspectRatio="none">
      {colors.map((c, i) => (
        <path key={c} d={d} stroke={c} strokeWidth="26" strokeDasharray="12 24" strokeDashoffset={-i * 12} />
      ))}
    </svg>
  );
}
