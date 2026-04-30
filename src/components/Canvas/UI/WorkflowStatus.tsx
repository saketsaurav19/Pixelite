import React from 'react';
import { useStore } from '../../../store/useStore';
import {
  Image, Layers, Sun, Zap, Download,
  CheckCircle, Clock, Loader2, AlertCircle
} from 'lucide-react';

export const WorkflowStatus: React.FC = () => {
  const { workflow, isLightingEnabled, activeTool } = useStore();

  if (activeTool !== 'lighting' && !isLightingEnabled) return null;

  const steps = [
    { id: 'image', label: 'Image', icon: Image },
    { id: 'depth', label: 'Depth', icon: Layers },
    { id: 'simulation', label: 'Simulation', icon: Sun },
    { id: 'refinement', label: 'Refinement', icon: Zap },
    { id: 'output', label: 'Output', icon: Download },
  ];

  const getStatusIcon = (status: string, isActive: boolean) => {
    switch (status) {
      case 'completed': return <CheckCircle size={12} className="text-green-400" />;
      case 'loading': return <Loader2 size={12} className="animate-spin text-blue-400" />;
      case 'error': return <AlertCircle size={12} className="text-red-400" />;
      default: return isActive ? <Clock size={12} className="text-blue-300" /> : <Clock size={12} className="opacity-30" />;
    }
  };

  return (
    <div className="workflow-status-container" style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(15, 15, 15, 0.85)',
      backdropFilter: 'blur(12px)',
      padding: '12px 24px',
      borderRadius: '40px',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      zIndex: 2000,
      pointerEvents: 'auto',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {steps.map((step, index) => {
        const status = workflow.status[step.id as keyof typeof workflow.status];
        const isActive = workflow.step === step.id;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              opacity: (isActive || status === 'completed') ? 1 : 0.4,
              scale: isActive ? '1.1' : '1',
              transition: 'all 0.3s ease',
              minWidth: '70px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: isActive ? '1px solid rgba(59, 130, 246, 0.5)' : 'none',
                position: 'relative'
              }}>
                <Icon size={18} color={isActive ? '#60a5fa' : '#fff'} />
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  backgroundColor: '#0f0f0f',
                  borderRadius: '50%',
                  padding: '1px'
                }}>
                  {getStatusIcon(status, isActive)}
                </div>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#60a5fa' : '#ccc',
                letterSpacing: '0.5px'
              }}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div style={{
                width: '30px',
                height: '1px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {status === 'completed' && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981'
                  }} />
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
