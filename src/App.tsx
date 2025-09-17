import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { MusicPlayer } from './components/MusicPlayer'
import { VideoTest } from './components/VideoTest'
import './App.css'

function Home() {
  return (
    <div className="App">
      <nav className="p-4 bg-gray-100 mb-8">
        <div className="max-w-4xl mx-auto flex gap-4 justify-center">
          <Link 
            to="/" 
            className="text-blue-500 hover:text-blue-600 underline font-medium"
          >
            Home
          </Link>
          <Link 
            to="/video" 
            className="text-blue-500 hover:text-blue-600 underline font-medium"
          >
            Video Test
          </Link>
        </div>
      </nav>
      <MusicPlayer />
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video" element={<VideoTest />} />
      </Routes>
    </Router>
  )
}

export default App
