import { KeyIcon } from "lucide-react"
import { Button } from "./components/ui/button"

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Pass Keeper</h1>
        <p className="text-xl text-gray-600 mb-8">
          Securely store and manage your passwords
        </p>
        <Button>
          <KeyIcon className="mr-2 h-4 w-4" /> Go to Password Keeper
        </Button>
      </div>
    </div>
  )
}

export default App
