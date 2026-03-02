import React from 'react'
import ReactDOM from 'react-dom/client'
import ProjectRoot from './ProjectRoot'
import './index.css'

const rootElement = document.getElementById('root');
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <ProjectRoot />
        </React.StrictMode>,
    );
}
