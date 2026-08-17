// src/components/AutocompleteInput.jsx
// Input de texto con sugerencias propias (no <datalist> nativo del navegador):
// - Ignora acentos al comparar (escribir "Jose" encuentra "JOSÉ").
// - No muestra nada hasta que el usuario empieza a escribir (limpio en celular).
// - Si lo que escriben no coincide con ninguna sugerencia, se queda tal cual
//   (permite texto libre para gente que no está en la lista, ej. externos).

import { useEffect, useRef, useState } from 'react';

function normalizar(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita acentos para comparar sin importar tildes
}

export default function AutocompleteInput({
  value,
  onChange,
  sugerencias,
  placeholder,
  className,
  disabled,
  required,
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  const coincidencias =
    value.trim().length > 0
      ? sugerencias.filter((s) => normalizar(s).includes(normalizar(value))).slice(0, 8)
      : [];

  useEffect(() => {
    function alClicFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', alClicFuera);
    return () => document.removeEventListener('mousedown', alClicFuera);
  }, []);

  return (
    <div className="relative" ref={contenedorRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        required={required}
        autoComplete="off"
      />
      {abierto && coincidencias.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded-lg shadow-lg text-sm">
          {coincidencias.map((s) => (
            <li
              key={s}
              onMouseDown={() => { onChange(s); setAbierto(false); }}
              className="px-3 py-2 hover:bg-itd-sand cursor-pointer"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
