import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  showBorder?: boolean;
}

export default function LogoITD({ className = 'w-12 h-12', showBorder = false }: LogoProps) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [useVectorFallback, setUseVectorFallback] = useState(false);

  const rutas = [
    encodeURI('/logos/logo-itd original.jpg'),
    '/logos/logo-itd original.jpg',
    '/logos/logo-itd.jpg',
    '/logos/logo-itd.png',
    encodeURI('/logo-itd original.jpg'),
    '/logo-itd original.jpg',
    '/logo-itd.jpg',
    '/logo-itd.png',
  ];

  if (useVectorFallback) {
    return (
      <svg viewBox="0 0 200 200" className={`${className} object-contain`} xmlns="http://www.w3.org/2000/svg">
        {/* Doble aro guinda ITD */}
        <circle cx="100" cy="100" r="95" fill="#ffffff" stroke="#800020" strokeWidth="6" />
        <circle cx="100" cy="100" r="82" fill="#ffffff" stroke="#800020" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="67" fill="#ffffff" stroke="#800020" strokeWidth="3" />
        
        {/* Texto circular superior */}
        <path id="itdCurvaTextoNav" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
        <text fill="#800020" fontSize="12.5" fontWeight="900" letterSpacing="2.2" fontFamily="Arial, sans-serif">
          <textPath href="#itdCurvaTextoNav" startOffset="50%" textAnchor="middle">
            TECNOLOGICO DE DURANGO
          </textPath>
        </text>
        
        {/* Año 1948 */}
        <text x="100" y="188" fill="#800020" fontSize="16" fontWeight="900" textAnchor="middle" letterSpacing="4" fontFamily="Arial, sans-serif">
          1948
        </text>

        {/* Águila del ITD y Escudo */}
        <g transform="translate(38, 40) scale(0.62)">
          {/* Alas doradas/marrón */}
          <path d="M 20 60 C -10 20, 40 -10, 80 15 C 65 35, 50 60, 20 60 Z" fill="#996515" stroke="#5c3d0c" strokeWidth="2"/>
          <path d="M 180 60 C 210 20, 160 -10, 120 15 C 135 35, 150 60, 180 60 Z" fill="#996515" stroke="#5c3d0c" strokeWidth="2"/>
          <path d="M 30 75 C 5 45, 50 25, 80 35 C 70 55, 55 75, 30 75 Z" fill="#b8860b" />
          <path d="M 170 75 C 195 45, 150 25, 120 35 C 130 55, 145 75, 170 75 Z" fill="#b8860b" />
          
          {/* Cabeza */}
          <ellipse cx="100" cy="40" rx="16" ry="18" fill="#8b5a2b" stroke="#5c3d0c" strokeWidth="2" />
          <path d="M 100 32 Q 118 36 112 46 Q 104 42 100 42 Z" fill="#ffd700" stroke="#b8860b" strokeWidth="1" />
          <circle cx="96" cy="36" r="3" fill="#ffffff" />
          <circle cx="96" cy="36" r="1.5" fill="#000000" />
          
          {/* Cola */}
          <path d="M 80 145 L 70 185 L 100 195 L 130 185 L 120 145 Z" fill="#8b5a2b" stroke="#5c3d0c" strokeWidth="2" />
          {/* Garras */}
          <ellipse cx="75" cy="140" rx="10" ry="7" fill="#ffd700" stroke="#b8860b" strokeWidth="1.5" />
          <ellipse cx="125" cy="140" rx="10" ry="7" fill="#ffd700" stroke="#b8860b" strokeWidth="1.5" />
          
          {/* Escudo Guinda Central */}
          <rect x="58" y="55" width="84" height="92" rx="6" fill="#ffffff" stroke="#800020" strokeWidth="7" />
          <text x="100" y="85" fill="#800020" fontSize="22" fontWeight="900" textAnchor="middle" fontFamily="Arial Black, sans-serif">
            ITD
          </text>
          
          {/* Engrane y Matraz */}
          <circle cx="100" cy="115" r="14" fill="#a0a0a0" stroke="#606060" strokeWidth="2" strokeDasharray="5,3" />
          <polygon points="95,95 105,95 108,122 92,122" fill="#2563eb" opacity="0.85" />
        </g>
      </svg>
    );
  }

  return (
    <img
      src={rutas[srcIndex]}
      onError={() => {
        if (srcIndex < rutas.length - 1) {
          setSrcIndex(srcIndex + 1);
        } else {
          setUseVectorFallback(true);
        }
      }}
      alt="Logo ITD"
      className={`${className} object-contain`}
    />
  );
}
