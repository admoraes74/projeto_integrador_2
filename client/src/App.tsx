import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import Professional from "@/pages/Professional";
import ProviderForm from "@/pages/ProviderForm";
import ProviderServices from "@/pages/ProviderServices";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/profissional/:id" component={Professional} />
    <Route path="/cadastro/servicos" component={ProviderServices} />
    <Route path="/cadastro" component={ProviderForm} />
    <Route path="/painel" component={Dashboard} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
