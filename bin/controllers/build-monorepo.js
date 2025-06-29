const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const { VueLoaderPlugin } = require('vue-loader');
const autoprefixer = require('autoprefixer');
const monorepo = require('../core/monorepo.js');

exports.buildMonorepo = (outputName) => {
    const components = monorepo.getMonorepoComponents();
    
    if (components.length === 0) {
        console.log('\x1b[41m Error: No components found in monorepo. \x1b[0m');
        return;
    }

    const PACKAGE_DIRECTORY = process.cwd();
    const TMP_BUILD_DIRECTORY = `${PACKAGE_DIRECTORY}/tmp-monorepo-build`;
    const TMP_INDEX_PATH = path.join(TMP_BUILD_DIRECTORY, 'index.js');

    // Read main package.json
    const packageJSON = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIRECTORY, 'package.json'), 'utf8'));
    const version = packageJSON.version;

    // Create temporary build directory
    if (!fs.existsSync(TMP_BUILD_DIRECTORY)) {
        fs.mkdirSync(TMP_BUILD_DIRECTORY, { recursive: true });
    }

    // Generate index.js that imports all components
    let indexContent = `// Auto-generated monorepo bundle\n`;

    // Import all components and configs
    components.forEach((component, index) => {
        const componentPath = path.join(PACKAGE_DIRECTORY, component.path);
        const configPath = path.join(componentPath, 'ww-config');
        
        let configFile = null;
        if (fs.existsSync(`${configPath}.js`)) {
            configFile = `${configPath}.js`;
        } else if (fs.existsSync(`${configPath}.json`)) {
            configFile = `${configPath}.json`;
        }

        if (!configFile) {
            console.log(`\x1b[43m Warning: No ww-config found for ${component.name} \x1b[0m`);
            return;
        }

        // Find component file
        let componentFile = null;
        const srcPath = path.join(componentPath, 'src');
        
        if (component.type === 'element' && fs.existsSync(path.join(srcPath, 'wwElement.vue'))) {
            componentFile = path.join(srcPath, 'wwElement.vue');
        } else if (component.type === 'section' && fs.existsSync(path.join(srcPath, 'wwSection.vue'))) {
            componentFile = path.join(srcPath, 'wwSection.vue');
        } else if (component.type === 'plugin' && fs.existsSync(path.join(srcPath, 'wwPlugin.js'))) {
            componentFile = path.join(srcPath, 'wwPlugin.js');
        }

        if (!componentFile) {
            console.log(`\x1b[43m Warning: No component file found for ${component.name} \x1b[0m`);
            return;
        }

        const relativeComponentPath = path.relative(TMP_BUILD_DIRECTORY, componentFile).split(path.sep).join('/');
        const relativeConfigPath = path.relative(TMP_BUILD_DIRECTORY, configFile).split(path.sep).join('/');

        indexContent += `import component_${index} from '${relativeComponentPath}';\n`;
        indexContent += `import config_${index} from '${relativeConfigPath}';\n`;
    });

    // Create components array
    indexContent += `
const components = [
${components.map((component, index) => `    {
        name: '${component.name}',
        type: '${component.type}',
        content: component_${index},
        config: config_${index}
    }`).join(',\n')}
];

// Single registration function for all components
function addComponents() {
    if (window.addWwComponent) {
        components.forEach(component => {
            const config = { ...component.config };
            config.name = component.name;
            
            window.addWwComponent({
                name: component.name,
                version: '${version}',
                content: component.content,
                type: component.type,
                config: config,
            });
        });
        return true;
    }
    return false;
}

// Try to register components immediately or wait for window.addWwComponent
if (!addComponents()) {
    const iniInterval = setInterval(function () {
        if (addComponents()) {
            clearInterval(iniInterval);
        }
    }, 10);
}

// Export for potential direct usage
export default components;
`;

    fs.writeFileSync(TMP_INDEX_PATH, indexContent);

    // Configure webpack for monorepo build
    const wewebCliPath = path.resolve(__dirname, '../..');
    
    const webpackConfig = {
        name: 'monorepo',
        entry: TMP_INDEX_PATH,
        mode: 'production',
        externals: {
            vue: 'Vue',
        },
        resolve: {
            modules: ['node_modules', path.resolve(`${wewebCliPath}/node_modules`)],
            descriptionFiles: ['package.json', path.resolve(`${wewebCliPath}/package.json`)],
            alias: {
                // Add aliases for each component's directory to help with relative imports
                ...components.reduce((acc, component) => {
                    const componentPath = path.join(PACKAGE_DIRECTORY, component.path);
                    acc[`@${component.name}`] = componentPath;
                    return acc;
                }, {})
            },
            fallback: { 
                "assert": false,
                "buffer": false,
                "child_process": false,
                "cluster": false,
                "crypto": false,
                "dgram": false,
                "dns": false,
                "domain": false,
                "events": false,
                "fs": false,
                "http": false,
                "https": false,
                "net": false,
                "os": false,
                "path": false,
                "punycode": false,
                "querystring": false,
                "readline": false,
                "stream": false,
                "string_decoder": false,
                "timers": false,
                "tls": false,
                "tty": false,
                "url": false,
                "util": false,
                "v8": false,
                "vm": false,
                "zlib": false,
            },
        },
        resolveLoader: {
            modules: ['node_modules', path.resolve(`${wewebCliPath}/node_modules`)],
            descriptionFiles: ['package.json', path.resolve(`${wewebCliPath}/package.json`)],
        },
        module: {
            rules: [
                {
                    test: /\.(js|css|scss)$/,
                    loader: 'weweb-strip-block',
                    options: {
                        blocks: [
                            {
                                start: 'wwFront:start',
                                end: 'wwFront:end',
                            },
                        ],
                    },
                },
                {
                    test: /\.?(jsx|tsx)(\?.*)?$/,
                    exclude: /(node_modules|bower_components)/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-react'],
                            plugins: ['@babel/transform-react-jsx'],
                        },
                    },
                },
                {
                    test: /\.vue$/,
                    use: [
                        'vue-loader',
                        {
                            loader: 'weweb-strip-block',
                            options: {
                                blocks: [
                                    {
                                        start: 'wwFront:start',
                                        end: 'wwFront:end',
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    test: /\.js$/,
                    loader: 'babel-loader',
                },
                {
                    test: /\.mjs$/,
                    include: /node_modules/,
                    type: 'javascript/auto',
                },
                {
                    test: /\.(css|scss)$/,
                    use: [
                        'vue-style-loader',
                        'css-loader',
                        {
                            loader: 'postcss-loader',
                            options: {
                                postcssOptions: {
                                    plugins: function () {
                                        return [autoprefixer];
                                    },
                                },
                            },
                        },
                        'sass-loader',
                    ],
                },
                {
                    test: /\.(png|jpg|gif|svg)$/i,
                    use: [
                        {
                            loader: 'url-loader',
                            options: {
                                limit: 8192,
                            },
                        },
                    ],
                },
            ],
        },
        output: {
            path: path.join(PACKAGE_DIRECTORY, 'dist'),
            filename: outputName || 'monorepo-bundle.js',
            library: {
                name: 'WeWebMonorepoComponents',
                type: 'umd',
            },
        },
        plugins: [
            new webpack.DefinePlugin({
                __VUE_OPTIONS_API__: 'true',
                __VUE_PROD_DEVTOOLS__: 'false',
                __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
            }),
            new VueLoaderPlugin(),
        ],
        optimization: {
            // Enable tree shaking
            usedExports: true,
            sideEffects: false,
        }
    };

    console.log(`\x1b[44m Building monorepo bundle with ${components.length} components... \x1b[0m`);
    components.forEach(c => {
        console.log(`  - ${c.name} (${c.type})`);
    });

    webpack(webpackConfig, function (err, stats) {
        // Clean up temp files
        if (fs.existsSync(TMP_INDEX_PATH)) {
            fs.unlinkSync(TMP_INDEX_PATH);
        }
        if (fs.existsSync(TMP_BUILD_DIRECTORY)) {
            fs.rmdirSync(TMP_BUILD_DIRECTORY);
        }

        if (err) {
            console.error(err);
            console.log('\x1b[41m Error: Monorepo build failed. \x1b[0m');
            return;
        }

        const info = stats.toJson();

        if (stats.hasErrors()) {
            console.error(info.errors);
            console.log('\x1b[41m Error: Monorepo build failed. \x1b[0m');
            return;
        }

        console.log('\x1b[42m Success: Monorepo bundle created! \x1b[0m');
        console.log(`Output: ${path.join(PACKAGE_DIRECTORY, 'dist', outputName || 'monorepo-bundle.js')}`);
    });
};