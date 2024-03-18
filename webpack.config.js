const path = require('path');

module.exports = {
    mode: 'development',
				entry: './src/index.ts',
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
				},
				output: {
				        filename: 'main.js',
				        path: path.join(__dirname, "dist")
				},
				devServer: {
				    static: {
				      directory: path.join(__dirname, "dist"),
				    }
				}
}
