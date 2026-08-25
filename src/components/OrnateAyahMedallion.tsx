import React from 'react';
import { convertToArabicDigits } from '../utils/editorUtils';

interface OrnateAyahMedallionProps {
  ayahNumber: number;
  digitType?: 'arabic' | 'latin';
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Authentic Kashmiri / Ottoman Mushaf Crowned Ornate Ayah Medallion
 * Vector SVG reproduction matching the user's provided ornamental scripture cartouche.
 */
export const OrnateAyahMedallion: React.FC<OrnateAyahMedallionProps> = ({
  ayahNumber,
  digitType = 'arabic',
  size = 36,
  color = 'currentColor',
  className = '',
}) => {
  const digits = digitType === 'arabic' ? convertToArabicDigits(ayahNumber) : String(ayahNumber);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 120"
      width={size}
      height={(size * 120) / 100}
      className={`inline-block align-middle select-none shrink-0 ${className}`}
      style={{ verticalAlign: 'middle' }}
    >
      <g fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Top Crown / Finial Apex */}
        <path d="M50 4 C48 10 44 14 41 16 C47 15 53 15 59 16 C56 14 52 10 50 4 Z" fill={color} fillOpacity="0.15" />
        <circle cx="50" cy="5" r="2" fill={color} />

        {/* Outer Oval Cartouche Frame with pointed tips */}
        <path d="M50 14 C76 18 90 38 90 60 C90 82 76 102 50 106 C24 102 10 82 10 60 C10 38 24 18 50 14 Z" />
        
        {/* Inner Oval Frame */}
        <path d="M50 24 C70 28 80 44 80 60 C80 76 70 92 50 96 C30 92 20 76 20 60 C20 44 30 28 50 24 Z" strokeWidth="1.5" />

        {/* Top Ornate Filigree Arabesque Scrollwork */}
        <path d="M38 19 C42 25 45 28 50 28 C55 28 58 25 62 19" strokeWidth="1.8" />
        <path d="M32 23 C36 29 42 32 48 31" strokeWidth="1.5" />
        <path d="M68 23 C64 29 58 32 52 31" strokeWidth="1.5" />
        
        {/* Upper Symmetrical Rosette Volutes */}
        <path d="M36 27 C30 32 30 38 37 38 C43 38 46 34 45 29" strokeWidth="1.5" />
        <path d="M64 27 C70 32 70 38 63 38 C57 38 54 34 55 29" strokeWidth="1.5" />

        {/* Bottom Symmetrical Rosette Volutes */}
        <path d="M36 93 C30 88 30 82 37 82 C43 82 46 86 45 91" strokeWidth="1.5" />
        <path d="M64 93 C70 88 70 82 63 82 C57 82 54 86 55 91" strokeWidth="1.5" />

        {/* Bottom Filigree Arabesque Scrolls & Tail */}
        <path d="M38 101 C42 95 45 92 50 92 C55 92 58 95 62 101" strokeWidth="1.8" />
        <path d="M32 97 C36 91 42 88 48 89" strokeWidth="1.5" />
        <path d="M68 97 C64 91 58 88 52 89" strokeWidth="1.5" />

        {/* Bottom Finial Tip */}
        <path d="M46 105 C48 111 50 115 50 117 C50 115 52 111 54 105" strokeWidth="2" fill={color} fillOpacity="0.2" />
        <circle cx="50" cy="116" r="1.5" fill={color} />
      </g>

      {/* Central Verse / Ayah Arabic Number */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={digits.length > 2 ? '22' : digits.length === 2 ? '26' : '30'}
        fontWeight="bold"
        fontFamily="sans-serif, 'Amiri', 'Traditional Arabic', 'Scheherazade New'"
      >
        {digits}
      </text>
    </svg>
  );
};

export default OrnateAyahMedallion;
