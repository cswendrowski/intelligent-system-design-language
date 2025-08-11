# Welcome to Intelligent System Design Language!

<img width="1024" height="1024" alt="isdl" src="https://github.com/user-attachments/assets/03264bb0-3ca9-494e-99ff-0aaa8743b512" />

Intelligent System Design Language (ISDL) is a custom programming language that enables you to create professional Virtual Tabletop Systems in hours, not months. It generates modern Foundry VTT systems compatible with Foundry V12 and V13 using cutting-edge web technologies.

ISDL provides both a **VS Code extension** and **CLI tool** for development, featuring syntax highlighting, intelligent validation, autocomplete, and seamless GitHub integration for publishing and sharing your systems.

<img width="1303" height="1029" alt="image" src="https://github.com/user-attachments/assets/c4f9aed8-b872-4936-a3ec-135248c64f1d" />

## ✨ Key Features

### 🎨 Modern User Interface
* **Vue 3 + Vuetify** powered reactive character sheets for smooth, responsive gameplay
* **Advanced DataTables** with search, filter, sort, and drag-drop functionality - perfect for managing inventories and spell lists
* **Edit vs Play Mode** toggle for clear distinction between character building and gameplay
* **Responsive Design** optimized for desktop and tablet use

### ⚡ Enhanced Active Effects
* **Visual Editor** integration for creating effects through the familiar Foundry interface  
* **Smart Targeting** with automatic field detection and validation
* **Condition Management** with built-in status effect handling

### 🎲 Intelligent Game Mechanics  
* **Smart Dice Operations** - multiply a d4 by 2 and get a d8, because that makes sense for tabletop games
* **Enhanced Roll System** showing detailed breakdowns with labeled components
* **Conditional Visibility** - show Ki trackers only for Monks, spell slots only for casters, etc.
* **Resource Management** with automatic token bar integration and damage application

### 🔗 Seamless Publishing & Sharing
* **GitHub Integration** - authenticate, publish systems, and manage releases directly from VS Code
* **Automated Versioning** with semantic version detection based on your ISDL changes
* **Gist Sharing** for quick collaboration and system prototypes
* **Quality Releases** with auto-generated installation instructions and changelogs

### 🛠️ Developer Experience
* **VS Code Extension** with full language support, syntax highlighting, and intelligent autocomplete
* **CLI Tool** for build automation and CI/CD integration
* **Real-time Validation** catching errors as you type
* **Minimal Setup Needed** so you can get started easily

## 🚀 Quick Start

Ready to create your first system? Choose your preferred development environment:

### 📝 **VS Code Extension** (Recommended)
1. Install the [ISDL extension](https://marketplace.visualstudio.com/items?itemName=IronMooseDevelopment.fsdl) from the VS Code marketplace
2. Create a new `.isdl` file and start coding with full intellisense support
3. Use `Ctrl+Shift+P` → `ISDL - Generate` to create your Foundry system
4. Connect to GitHub for easy publishing and sharing

### 📚 **Learn More**
* **[Getting Started Guide](https://github.com/cswendrowski/intelligent-system-design-language/wiki/Getting-Started)** - Complete setup and first system tutorial
* **[Your First System](https://github.com/cswendrowski/intelligent-system-design-language/wiki/Your-first-System)** - Step-by-step walkthrough
* **[GitHub Integration](https://github.com/cswendrowski/intelligent-system-design-language/wiki/GitHub-Integration)** - Publishing and sharing guide
* **[Examples](https://github.com/cswendrowski/intelligent-system-design-language/tree/main/isdl/examples)** - Real system examples to learn from

---

## 🎯 Design Philosophy

### 1: Programming made easy, but still light programming

Systems like Simple World Building, Custom System Builder, and Sandbox all offer a no-code click based way to build out small lightweight systems.

ISDL is not nearly as complicated as developing a full Foundry system from scratch, but it is still a programming language. Basic familiarity with scripting languages as Javascript will be useful.

### 2: Do what makes sense

There are a lot of options and customization available, but if you use the default syntax it should provide a reasonable default.

When working with Datatypes like a list of Die size choices, most languages would reject `self.DieSize += 1` - adding `1` to a string doesn't make sense for most languages. For ISDL, we raise the value to the next die size, because that's what makes sense for Tabletop games. Multiply a d4 by 2? Now you have a d8.

### 3: Just enough Typing

Some programming languages have no typing, meaning you can pass a number to something that expects a string and the function will have to deal with it - or error. Even simple typos can error.

Other languages provide fully enforced typing which protects you from these mistakes, but can add a lot of extra work doing type conversions and checks.

ISDL provides just enough typing to protect yourself from things like typos and errors, without requiring a ton of extra work.

## Let's go!

**Ready to start your system development?** 

👉 **[Start with the Getting Started Guide](https://github.com/cswendrowski/intelligent-system-design-language/wiki/Getting-Started)**
