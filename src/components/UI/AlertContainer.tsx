import React from 'react';
import { useStore } from '../../store/useStore';
import './Alert.css';

export const AlertContainer: React.FC = () => {
  const alerts = useStore(state => state.alerts);

  return (
    <div className="alert-container">
      {alerts.map((alert: any) => (
        <div key={alert.id} className={`alert-box alert-${alert.type}`}>
          <span className="alert-type">{alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}:</span> {alert.message}
        </div>
      ))}
    </div>
  );
};
