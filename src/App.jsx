import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <h1 className="text-4xl text-red-500 font-bold">
      Tailwind v4 working 🚀
    </h1>
  )
}

export default App
