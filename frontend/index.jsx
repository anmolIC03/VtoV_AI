import React from 'react'
import ReactDOM from 'react-dom/client'
import GeminiAdventureApp from './app.jsx' // Make sure the import matches your app.jsx export name

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GeminiAdventureApp />
  </React.StrictMode>,
)