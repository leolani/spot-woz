# cltl-chat-ui

Simple text based chat UI.

The chat UI can be used to display text signals and create text signals from user input.

This repository is a component of the [Leolani framework](https://github.com/leolani/cltl-combot).
For usage of the component within the framework see the instructions there.

## Empirica Game

### Setup Game

#### Setup the server

* Build Docker image:
     
      docker build -t <TAG_NAME> .

  according to the [documentation](https://docs.docker.com/get-started/docker-concepts/building-images/build-tag-and-publish-an-image/)
  and configure the tag name in `spot-game/.empirica/treatments.yaml` or the Empirica Admin console.

* Install [Empirica](https://docs.empirica.ly/)
* Deploy Empirica Game from the `spot-game/` folder according to the [documentation](https://docs.empirica.ly/guides/deploying-my-experiment).

#### Deploy Empirica game

To deploy a new version of the Empirica game:
* in _spot-game/.empirica/empirica.toml_ set the admin password for the server (don't commit this to _git_)
* in _spot-game/.empirica_ copy _treatments.yaml.server_ to _treatments.yaml_
* in _spot-game/_ run

      empirica bundle

* upload the created bundle to the server:

      scp spot-game.tar.zst <username>@spotter.labs.vu.nl:empirica

* login to the server, navigate to the _empirica/_ folder and run

      ./deploy.sh

  to deploy the new version. To also clear the Empirica data (_/home/spotter/empirica/.empirica/local/tajriba.json_), run

      ./deploy.sh clean

* check the logs of the Empirica server with

      ./logs.sh empirica

  from the home directory.

#### Deploy Spotter game

To update the docker image of the Spotter game

* commit and push all changes in the modules and the parent (_spot-woz-parent_)
* login to the server, navigate to the _dockerbuild/_ folder and run

      rm nohup.out
      nohup ./build.sh &

  to clear the previous output of _nohup_ and run the build in the background.
  Check the _nohup.out_ file for progress. The build will continue to run in the background also if you logout of the server.

## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


<!-- LICENSE -->
## License

Distributed under the MIT License. See [`LICENSE`](https://github.com/leolani/cltl-combot/blob/main/LICENCE) for more information.

<!-- CONTACT -->
## Authors

* [Taewoon Kim](https://tae898.github.io/)
* [Thomas Baier](https://www.linkedin.com/in/thomas-baier-05519030/)
* [Selene Báez Santamaría](https://selbaez.github.io/)
* [Piek Vossen](https://github.com/piekvossen)
