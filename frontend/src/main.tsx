import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import { esCoordinacion } from './api'
import App from './App'
import './index.css'
import Agenda from './pages/Agenda'
import Alumnos from './pages/Alumnos'
import Cambios from './pages/Cambios'
import Compras from './pages/Compras'
import Docentes from './pages/Docentes'
import Espacios from './pages/Espacios'
import Feedback from './pages/Feedback'
import Gastos from './pages/Gastos'
import Inicio from './pages/Inicio'
import MiClave from './pages/MiClave'
import Objetivos from './pages/Objetivos'
import Pedir from './pages/Pedir'
import Plano from './pages/Plano'
import Talleres from './pages/Talleres'
import Tareas from './pages/Tareas'
import Usuarios from './pages/Usuarios'
import WhatsApp from './pages/WhatsApp'

function soloCoordinacion(elemento: ReactElement) {
  return esCoordinacion() ? elemento : <Navigate to="/" replace />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'agenda', element: <Agenda /> },
      { path: 'plano', element: <Plano /> },
      { path: 'talleres', element: <Talleres /> },
      { path: 'docentes', element: <Docentes /> },
      { path: 'alumnos', element: <Alumnos /> },
      { path: 'espacios', element: <Espacios /> },
      { path: 'whatsapp', element: <WhatsApp /> },
      { path: 'tareas', element: soloCoordinacion(<Tareas />) },
      { path: 'gastos', element: soloCoordinacion(<Gastos />) },
      { path: 'compras', element: <Compras /> },
      { path: 'feedback', element: soloCoordinacion(<Feedback />) },
      { path: 'objetivos', element: soloCoordinacion(<Objetivos />) },
      { path: 'accesos', element: soloCoordinacion(<Usuarios />) },
      { path: 'mi-clave', element: <MiClave /> },
      { path: 'cambios', element: soloCoordinacion(<Cambios />) },
    ],
  },
  { path: '/pedir', element: <Pedir /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
