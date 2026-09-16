import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import './index.css'
import Agenda from './pages/Agenda'
import Alumnos from './pages/Alumnos'
import Docentes from './pages/Docentes'
import Espacios from './pages/Espacios'
import Inicio from './pages/Inicio'
import Talleres from './pages/Talleres'

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
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
