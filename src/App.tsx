import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CommuterHome from './screens/commuter/CommuterHome'
import DriverHome from './screens/driver/DriverHome'
import RouteLinePlayground from './components/RouteLine/RouteLinePlayground'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CommuterHome />} />
        <Route path="/driver" element={<DriverHome />} />
        <Route path="/dev/routeline" element={<RouteLinePlayground />} />
      </Routes>
    </BrowserRouter>
  )
}
