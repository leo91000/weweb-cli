const fs = require('fs');
const path = require('path');

/**
 * Detects if the current directory is a monorepo by checking for:
 * 1. A weweb.monorepo field in package.json
 * 2. Multiple component directories with ww-config files
 */
function isMonorepo() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
        return false;
    }
    
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Check if explicitly marked as monorepo
        if (packageJson.weweb && packageJson.weweb.monorepo === true) {
            return true;
        }
        
        // Check if components are defined
        if (packageJson.weweb && packageJson.weweb.components) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error reading package.json:', error);
        return false;
    }
}

/**
 * Gets the list of components in a monorepo
 * Returns array of { name, path, type }
 */
function getMonorepoComponents() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
        return [];
    }
    
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (!packageJson.weweb || !packageJson.weweb.components) {
            return [];
        }
        
        const components = packageJson.weweb.components;
        const result = [];
        
        // Handle array format
        if (Array.isArray(components)) {
            for (const component of components) {
                if (typeof component === 'string') {
                    // Simple string format: "components/my-element"
                    const componentPath = path.join(process.cwd(), component);
                    if (fs.existsSync(path.join(componentPath, 'ww-config.js')) || 
                        fs.existsSync(path.join(componentPath, 'ww-config.json'))) {
                        result.push({
                            name: path.basename(component),
                            path: component,
                            type: detectComponentType(componentPath)
                        });
                    }
                } else if (typeof component === 'object' && component.path) {
                    // Object format: { name: "my-element", path: "components/my-element", type: "element" }
                    const componentPath = path.join(process.cwd(), component.path);
                    if (fs.existsSync(path.join(componentPath, 'ww-config.js')) || 
                        fs.existsSync(path.join(componentPath, 'ww-config.json'))) {
                        result.push({
                            name: component.name || path.basename(component.path),
                            path: component.path,
                            type: component.type || detectComponentType(componentPath)
                        });
                    }
                }
            }
        } else if (typeof components === 'object') {
            // Object format: { "my-element": { path: "components/my-element", type: "element" } }
            for (const [name, config] of Object.entries(components)) {
                if (config && config.path) {
                    const componentPath = path.join(process.cwd(), config.path);
                    if (fs.existsSync(path.join(componentPath, 'ww-config.js')) || 
                        fs.existsSync(path.join(componentPath, 'ww-config.json'))) {
                        result.push({
                            name: name,
                            path: config.path,
                            type: config.type || detectComponentType(componentPath)
                        });
                    }
                }
            }
        }
        
        return result;
    } catch (error) {
        console.error('Error reading package.json:', error);
        return [];
    }
}

/**
 * Detects the type of component based on its files
 */
function detectComponentType(componentPath) {
    // Check for specific component files
    if (fs.existsSync(path.join(componentPath, 'src', 'wwElement.vue'))) {
        return 'element';
    }
    if (fs.existsSync(path.join(componentPath, 'src', 'wwSection.vue'))) {
        return 'section';
    }
    if (fs.existsSync(path.join(componentPath, 'src', 'wwPlugin.js'))) {
        return 'plugin';
    }
    
    // Check package.json for type
    const packageJsonPath = path.join(componentPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.weweb && packageJson.weweb.type) {
                return packageJson.weweb.type;
            }
        } catch (error) {
            // Ignore error
        }
    }
    
    // Default to element
    return 'element';
}

/**
 * Gets the component configuration for a specific component in the monorepo
 */
function getComponentConfig(componentName) {
    const components = getMonorepoComponents();
    return components.find(c => c.name === componentName);
}

module.exports = {
    isMonorepo,
    getMonorepoComponents,
    detectComponentType,
    getComponentConfig
};