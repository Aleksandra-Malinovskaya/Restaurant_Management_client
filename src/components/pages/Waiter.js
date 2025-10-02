import React from "react";
import NavBar from "../NavBar";

const Waiter = () => {
  return (
    <div className="min-vh-100 bg-light">
      <NavBar />
      <div className="container-fluid py-4">
        <h2>👨‍💼 Панель официанта</h2>
        <p>Управление заказами и бронированиями</p>
      </div>
    </div>
  );
};

export default Waiter;
