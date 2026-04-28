# Pixelite 🎨

**Pixelite** is a high-performance, professional-grade photo editor that runs entirely in your browser. Inspired by industry standards like Photoshop, it offers a rich set of tools for digital painting, photo manipulation, and vector design—all without a server or any cloud dependencies.

[![Star on GitHub](https://img.shields.io/github/stars/saketsaurav19/Pixelite?style=social)](https://github.com/saketsaurav19/Pixelite)
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://pixelite.taskcraft.site/)

## 🚀 Key Features

### 🖼️ Advanced Layer System
*   **Multi-Layer Management**: Create, duplicate, reorder, and delete layers with ease.
*   **Blend Modes**: Professional blending options including Multiply, Screen, Overlay, and more.
*   **Opacity & Visibility**: Fine-tune layer transparency and toggle visibility instantly.
*   **Layer Locking**: Protect your work from accidental modifications.

### 🖌️ Professional Painting Engine
*   **Versatile Brushes**: A suite of tools including Brush, Pencil, and Eraser.
*   **Retouching Suite**: Advanced tools like Healing Brush, Patch tool, Dodge, Burn, and Smudge.
*   **Artistic Effects**: Blur, Sharpen, and Art History Brush for creative finishes.
*   **Mixer Brush**: Experience natural media blending directly on the canvas.

### 📐 Selection & Transform Tools
*   **Smart Selection**: Magic Wand, Quick Selection, and Object Selection tools.
*   **Lasso Suite**: Free-form, Polygonal, and Magnetic lasso for precise cutouts.
*   **Perspective Crop**: 8-point quad manipulation with a rule-of-thirds grid for perfect perspective correction.
*   **Standard Crop**: Clean, 4-handle crop tool with canvas movement support.

### ✒️ Vector Design
*   **Pen Tool**: Create precise paths with the standard Pen, Curvature Pen, and Freeform Pen.
*   **Path Manipulation**: Add/delete anchor points and convert point types.
*   **Direct Selection**: Move individual anchors or entire paths.

### 🤖 AI-Powered Tools
*   **Background Removal**: One-click background removal powered by local AI processing (no server required).
*   **Subject Selection**: Automatically detect and select the primary subject in your layer.

### ⚡ Performance & UX
*   **Full Browser Execution**: All processing happens locally on your device. Your data never leaves your computer.
*   **GPU Accelerated Rendering**: High-performance canvas rendering with 32-bit color support.
*   **Full History System**: Robust undo/redo functionality to explore creative directions safely.
*   **Responsive Design**: Fully optimized for Desktop, Tablet, and Mobile with native touch gesture support.

## 🛠️ Technology Stack

*   **Core**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand) (Modular slice-based architecture)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **AI**: [@imgly/background-removal](https://www.npmjs.com/package/@imgly/background-removal)

## 📦 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (Latest LTS version recommended)
*   npm or yarn

### Installation
1.  Clone the repository:
    ```bash
    git clone https://github.com/saketsaurav19/Pixelite.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd Pixelite
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```

## 📱 Mobile Support
Pixelite is designed to be a first-class citizen on mobile devices.
*   **Pinch to Zoom**: Natural multi-touch zooming and panning.
*   **Touch Optimizations**: Custom touch handlers for all painting and selection tools.
*   **Adaptive UI**: A responsive interface that rearranges panels and toolbars for smaller screens.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request or open an issue for any bugs or feature requests.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Made with passion by [Saket Saurav](https://github.com/saketsaurav19)
