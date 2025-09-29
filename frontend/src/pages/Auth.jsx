import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Music, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';

const Auth = () => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });
  
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.login(loginForm);
      login(response);
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Erro no login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.register(registerForm);
      login(response);
      toast.success('Conta criada com sucesso!');
    } catch (error) {
      console.error('Register error:', error);
      toast.error('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 pattern-grid opacity-30"></div>
      
      <div className="w-full max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center relative z-10">
        {/* Hero Section */}
        <div className="space-y-8 text-center md:text-left">
          <div className="space-y-4">
            <div className="flex items-center justify-center md:justify-start space-x-3">
              <div className="relative">
                <Music className="w-12 h-12 text-amber-600" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <Zap className="w-3 h-3 text-white" />
                </div>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 font-['Inter']">
                Music Maestro
              </h1>
            </div>
            
            <p className="text-xl text-gray-700 font-['Inter'] leading-relaxed">
              Plataforma colaborativa para músicos tocarem juntos com 
              <span className="text-amber-600 font-semibold"> inteligência artificial</span>
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200/50 shadow-lg">
              <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Repertório Sincronizado</h3>
              <p className="text-sm text-gray-600">Todos veem a mesma música em tempo real</p>
            </div>
            
            <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200/50 shadow-lg">
              <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Instrumentos Específicos</h3>
              <p className="text-sm text-gray-600">Notas personalizadas para cada instrumento</p>
            </div>
            
            <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200/50 shadow-lg">
              <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">IA Musical</h3>
              <p className="text-sm text-gray-600">Recomendações inteligentes de próximas músicas</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-center md:justify-start space-x-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">11+</div>
              <div className="text-sm text-gray-600">Instrumentos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">∞</div>
              <div className="text-sm text-gray-600">Músicas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">AI</div>
              <div className="text-sm text-gray-600">Powered</div>
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <Card className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-lg border-amber-200/50 shadow-2xl">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">Bem-vindo</CardTitle>
            <CardDescription className="text-gray-600">
              Entre ou crie sua conta para começar
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-amber-50">
                <TabsTrigger 
                  value="login" 
                  className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
                  data-testid="login-tab"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
                  data-testid="register-tab"
                >
                  Criar Conta
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                      className="border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                      data-testid="login-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Sua senha"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      className="border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                      data-testid="login-password-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                    disabled={loading}
                    data-testid="login-submit-button"
                  >
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                      className="border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                      data-testid="register-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                      className="border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                      data-testid="register-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Crie uma senha segura"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                      className="border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                      data-testid="register-password-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                    disabled={loading}
                    data-testid="register-submit-button"
                  >
                    {loading ? 'Criando conta...' : 'Criar Conta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;