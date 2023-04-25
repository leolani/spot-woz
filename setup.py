from setuptools import setup, find_namespace_packages

with open("README.md", "r") as fh:
    long_description = fh.read()

with open("VERSION", "r") as fh:
    version = fh.read().strip()

setup(
    name='spot.chat-ui',
    version=version,
    package_dir={'': 'src'},
    packages=find_namespace_packages(include=['spot.*', 'spot_service.*'], where='src'),
    package_data={
        # setuptools doesn't expand /**/* globs (https://github.com/pypa/setuptools/issues/1806)
        "spot_service.chatui": ["static/*", "static/*/*", "static/*/*/*", "static/*/*/*/*", "static/*/*/*/*/*"],
        "spot_service.spot_game": ["static/*", "static/*/*", "static/*/*/*", "static/*/*/*/*", "static/*/*/*/*/*"]
    },
    data_files=[('VERSION', ['VERSION'])],
    url="https://github.com/leolani/spot-woz",
    license='MIT License',
    author='CLTL',
    author_email='t.baier@vu.nl',
    description='Simple chat user interface',
    long_description=long_description,
    long_description_content_type="text/markdown",
    python_requires='>=3.8',
    install_requires=['emissor', 'cltl.combot'],
    extras_require={
        "impl": [],
        "service": [
            "emissor",
            "flask"
        ]}
)
