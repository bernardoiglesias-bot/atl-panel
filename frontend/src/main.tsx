import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import './index.css'
import Agenda from './pages/Agenda'
import Alumnos from './pages/Alumnos'
import Compras from './pages/Compras'
import Docentes from './pages/Docentes'
import Espacios from './pages/Espacios'
import Feedback from './pages/Feedback'
import Gastos from './pages/Gastos'
import Inicio from './pages/Inicio'
import Objetivos from './pages/Objetivos'
import Pedir from './pages/Pedir'
import Talleres from './pages/Talleres'
import Tareas from './pages/Tareas'
import Usuarios from './pages/Usuarios'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'agenda', element: <Agenda /> },
      { path: 'talleres', element: <Talleres /> },
      { path: 'docentes', element: <Docentes /> },
      { path: 'alumnos', element: <Alumnos /> },
      { path: 'espacios', element: <Espacios /> },
      { path: 'tareas', element: <Tareas /> },
      { path: 'gastos', element: <Gastos /> },
      { path: 'compras', element: <Compras /> },
      { path: 'feedback', element: <Feedback /> },
      { path: 'objetivos', element: <Objetivos /> },
      { path: 'accesos', element: <Usuarios /> },
    ],
  },
  { path: '/pedir', element: <Pedir /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
