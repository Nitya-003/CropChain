def runCmd(String cmd) {
  if (isUnix()) {
    sh cmd
  } else {
    bat cmd
  }
}

pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '20'))
    skipDefaultCheckout(true)
  }

  environment {
    ARTIFACTS_DIR = 'artifacts/test-results'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        script {
          runCmd('npm --prefix frontend ci')
          runCmd('npm --prefix backend ci')
          runCmd('npm --prefix smart-contracts ci')
        }
        stash name: 'frontend-node-modules', includes: 'frontend/node_modules/**', useDefaultExcludes: false
        stash name: 'backend-node-modules', includes: 'backend/node_modules/**', useDefaultExcludes: false
        stash name: 'smart-contracts-node-modules', includes: 'smart-contracts/node_modules/**', useDefaultExcludes: false
      }
    }

    stage('Lint & Security Scan') {
      steps {
        unstash 'frontend-node-modules'
        unstash 'backend-node-modules'
        unstash 'smart-contracts-node-modules'
        script {
          runCmd('npm --prefix frontend run lint')
          runCmd('npx --yes prettier@3.3.3 --check .')
          runCmd('npm --prefix frontend audit --audit-level=high --omit=dev')
          runCmd('npm --prefix backend audit --audit-level=high --omit=dev')
          runCmd('npm --prefix smart-contracts audit --audit-level=high --omit=dev')
        }
      }
    }

    stage('Test Matrix') {
      parallel {
        stage('Smart Contract Tests') {
          steps {
            unstash 'smart-contracts-node-modules'
            script {
              runCmd(isUnix() ? 'mkdir -p artifacts/test-results' : 'if not exist artifacts\\test-results mkdir artifacts\\test-results')
              runCmd(isUnix()
                ? 'cd smart-contracts && npx hardhat test --reporter json > ../artifacts/test-results/hardhat-test.json'
                : 'cd smart-contracts && npx hardhat test --reporter json > ..\\artifacts\\test-results\\hardhat-test.json')
            }
          }
        }

        stage('Backend Integration Tests') {
          steps {
            unstash 'backend-node-modules'
            script {
              runCmd(isUnix() ? 'mkdir -p artifacts/test-results' : 'if not exist artifacts\\test-results mkdir artifacts\\test-results')
              runCmd('npm --prefix backend run test:ci -- --json --outputFile=../artifacts/test-results/backend-test.json')
            }
          }
        }

        stage('Frontend Unit Tests') {
          steps {
            unstash 'frontend-node-modules'
            script {
              runCmd(isUnix() ? 'mkdir -p artifacts/test-results' : 'if not exist artifacts\\test-results mkdir artifacts\\test-results')
              runCmd('npm --prefix frontend run test:ci -- --reporter=json --outputFile=../artifacts/test-results/frontend-test.json')
            }
          }
        }
      }
    }

    stage('Docker Build Verification') {
      steps {
        script {
          def buildTag = env.BUILD_NUMBER ?: 'local'
          runCmd("docker build -f docker/Dockerfile --target frontend-runner -t cropchain/frontend-ci:${buildTag} .")
          runCmd("docker build -f docker/Dockerfile --target backend-runner -t cropchain/backend-ci:${buildTag} .")
          runCmd("docker build -f frontend/Dockerfile.dev -t cropchain/frontend-dev-ci:${buildTag} frontend")
          runCmd("docker build -f backend/Dockerfile.dev -t cropchain/backend-dev-ci:${buildTag} backend")
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'artifacts/test-results/**', allowEmptyArchive: true, fingerprint: true
      cleanWs(cleanWhenNotBuilt: false, deleteDirs: true, disableDeferredWipeout: true)
    }
    success {
      echo "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER} completed all CI/CD checks."
    }
    failure {
      echo "FAILURE: ${env.JOB_NAME} #${env.BUILD_NUMBER} failed. Check archived artifacts and stage logs."
    }
  }
}
