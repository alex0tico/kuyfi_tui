#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app.js';

// Motor de arranque purificado. 
// Renderiza el componente de interfaz directamente en la terminal.
render(<App />);