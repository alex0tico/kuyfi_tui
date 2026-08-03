#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render } from 'ink';
import App from './app.js';

// Declaramos la instancia fuera para poder acceder a ella desde el Wrapper
let instance: any;

// Componente guardián que reacciona a los cambios físicos de la terminal
const TerminalManager = () => {
  // Estado "fantasma" que solo sirve para forzar a React a redibujar
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      // 1. Limpiamos el remanente visual (el bug de la cascada)
      if (instance) {
        instance.clear();
      }
      
      // 2. Forzamos el re-render de React al instante.
      // Como solo actualizamos el envoltorio, <App /> mantiene intacto su estado interno.
      setTick(prev => prev + 1);
    };

    // Escuchamos el cambio de tamaño nativo de Node
    process.stdout.on('resize', handleResize);
    
    // Limpieza del listener por buenas prácticas
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  // Renderizamos tu TUI de forma segura
  return <App />;
};

// Arrancamos el motor y capturamos la instancia
instance = render(<TerminalManager />);