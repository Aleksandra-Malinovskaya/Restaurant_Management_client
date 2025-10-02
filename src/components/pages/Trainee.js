import React from "react";
import NavBar from "../NavBar";

const Trainee = () => {
  return (
    <div className="min-vh-100 bg-light">
      <NavBar />
      <div className="container-fluid py-4">
        <h2>🎓 Панель стажера</h2>
        <p>Ожидание подтверждения администратором</p>
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          Ваш аккаунт ожидает подтверждения администратором для получения
          полного доступа.
        </div>
      </div>
    </div>
  );
};

export default Trainee;
