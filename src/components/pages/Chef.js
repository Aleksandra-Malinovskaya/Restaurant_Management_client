import React from "react";
import NavBar from "../NavBar";

const Chef = () => {
  return (
    <div className="min-vh-100 bg-light">
      <NavBar />
      <div className="container-fluid py-4">
        <h2>👨‍🍳 Панель повара</h2>
        <p>Управление заказами на кухне</p>
      </div>
    </div>
  );
};

export default Chef;
